"""Public Gig Wall SEO: JSON API, HTML pages, dynamic sitemap."""

from __future__ import annotations

import json

from django.conf import settings
from django.http import Http404, HttpResponse, HttpResponsePermanentRedirect
from django.shortcuts import get_object_or_404, render
from django.views import View
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .gig_public import (
    category_slug_for_gig,
    city_landing_urls,
    city_slug_for_gig,
    is_open_for_bids,
    parse_gig_slug_id,
    public_gig_path,
    sanitize_gig_for_public,
)
from .models import GigPost


def _gig_queryset():
    return GigPost.objects.select_related('customer', 'category')


class PublicGigDetailAPIView(APIView):
    """Sanitized gig payload for crawlers / clients. No auth."""

    permission_classes = [AllowAny]
    authentication_classes = []

    def get(self, request, gig_id):
        gig = get_object_or_404(_gig_queryset(), pk=gig_id)
        return Response(sanitize_gig_for_public(gig))


class PublicGigHTMLView(View):
    """Server-rendered public gig page (crawlable HTML)."""

    def get(self, request, city, category, slug_id):
        city = (city or '').strip().lower()
        if city not in ('ottawa', 'toronto'):
            raise Http404()

        gig_id = parse_gig_slug_id(slug_id)
        if gig_id is None:
            raise Http404()

        gig = get_object_or_404(_gig_queryset(), pk=gig_id)
        canonical_path = public_gig_path(gig)
        expected_city = city_slug_for_gig(gig)
        expected_category = category_slug_for_gig(gig)
        request_path = request.path if request.path.endswith('/') else f'{request.path}/'

        if (
            city != expected_city
            or category != expected_category
            or request_path != canonical_path
        ):
            return HttpResponsePermanentRedirect(canonical_path)

        data = sanitize_gig_for_public(gig)
        accepting = is_open_for_bids(gig.status)
        area = data['area_label']
        title_tag = f"{data['title']} in {area} | Luminexa Gig Wall"
        meta_description = (data['description'] or data['title'])[:160]
        site_root = getattr(settings, 'PUBLIC_APP_URL', 'https://app.luminex-a.com').rstrip('/') + '/'
        json_ld = [
            {
                '@context': 'https://schema.org',
                '@type': 'WebPage',
                'name': data['title'],
                'description': data['description'],
                'url': data['canonical_url'],
                'isPartOf': {
                    '@type': 'WebSite',
                    'name': 'Luminexa',
                    'url': site_root,
                },
            },
            {
                '@context': 'https://schema.org',
                '@type': 'Service',
                'name': data['title'],
                'description': data['description'],
                'provider': {'@type': 'Organization', 'name': 'Luminexa'},
                'areaServed': {
                    '@type': 'Place',
                    'name': area,
                },
                'url': data['canonical_url'],
            },
        ]

        return render(
            request,
            'jobs/public_gig.html',
            {
                'gig': data,
                'accepting_bids': accepting,
                'title_tag': title_tag,
                'meta_description': meta_description,
                'json_ld': json.dumps(json_ld, ensure_ascii=False),
                'city_display': 'Ottawa' if expected_city == 'ottawa' else 'Toronto',
            },
        )


class SitemapXmlView(View):
    """Dynamic sitemap: city SEO pages + all public gig URLs."""

    def get(self, request):
        lines = [
            '<?xml version="1.0" encoding="UTF-8"?>',
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
        ]
        for entry in city_landing_urls():
            lines.append('  <url>')
            lines.append(f"    <loc>{entry['loc']}</loc>")
            lines.append(f"    <changefreq>{entry['changefreq']}</changefreq>")
            lines.append(f"    <priority>{entry['priority']}</priority>")
            lines.append('  </url>')

        for gig in _gig_queryset().iterator(chunk_size=200):
            url = sanitize_gig_for_public(gig)['canonical_url']
            freq = 'daily' if is_open_for_bids(gig.status) else 'yearly'
            priority = '0.7' if is_open_for_bids(gig.status) else '0.4'
            lines.append('  <url>')
            lines.append(f'    <loc>{url}</loc>')
            lines.append(f'    <changefreq>{freq}</changefreq>')
            lines.append(f'    <priority>{priority}</priority>')
            lines.append('  </url>')

        lines.append('</urlset>')
        return HttpResponse('\n'.join(lines) + '\n', content_type='application/xml')
