import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import ServicePictureCarousel from '../../components/services/ServicePictureCarousel';
import ServiceRatingForm from '../../components/services/ServiceRatingForm';
import ServiceRatingSummary from '../../components/services/ServiceRatingSummary';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI } from '../../utils/api';
import { bookService, businessPage } from '../../utils/customerPaths';
import { formatServiceMeta } from '../../utils/serviceDisplay';

function ReviewDimensionBreakdown({ review }) {
  const dims = [
    { key: 'communication', label: 'Communication' },
    { key: 'price', label: 'Price' },
    { key: 'punctual', label: 'Punctual' },
    { key: 'quality', label: 'Quality of work' },
  ];
  return (
    <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
      {dims.map((d) => (
        <li key={d.key}>
          {d.label}: <span className="font-medium text-amber-500">★ {review[d.key]}</span>
        </li>
      ))}
    </ul>
  );
}

export default function CustomerServiceDetailPage() {
  const { slug, serviceId } = useParams();
  const { isAuthenticated } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await businessesAPI.getServiceDetail(slug, serviceId);
      setService(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Service not found.');
      setService(null);
    } finally {
      setLoading(false);
    }
  }, [slug, serviceId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitReview = async (payload) => {
    setSubmittingReview(true);
    setMessage(null);
    setError(null);
    try {
      await businessesAPI.submitServiceReview(slug, serviceId, payload);
      setMessage('Thank you for your rating!');
      await load();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not submit rating.');
    } finally {
      setSubmittingReview(false);
    }
  };

  const pictures = useMemo(() => {
    if (!service) return [];
    const gallery = service.gallery || [];
    if (gallery.length) return gallery;
    if (service.image_url) {
      return [{ id: 'cover', image_url: service.image_url }];
    }
    return [];
  }, [service]);

  if (loading) {
    return <p className="py-8 text-center text-slate-500">Loading service…</p>;
  }

  if (error && !service) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-600">{error}</p>
        <Link to={businessPage(slug)} className="mt-4 inline-block text-luminexa-accent">
          Back to business
        </Link>
      </div>
    );
  }

  const meta = formatServiceMeta(service);

  return (
    <div className="space-y-6">
      <header>
        <Link
          to={businessPage(slug)}
          className="text-sm font-medium text-luminexa-accent"
        >
          ← {service.organization_name}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900">{service.name}</h1>
        {service.category_name && (
          <p className="mt-1 text-sm text-slate-500">{service.category_name}</p>
        )}
        {meta && <p className="mt-2 text-sm font-medium text-slate-700">{meta}</p>}
      </header>

      <ServicePictureCarousel images={pictures} alt={service.name} />

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-slate-500">About this service</h2>
        {service.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {service.description}
          </p>
        ) : (
          <p className="mt-3 text-sm italic text-slate-400">No description provided.</p>
        )}
      </section>

      <div className="sticky bottom-0 -mx-4 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0">
        <Link
          to={bookService(slug, service.id)}
          className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-luminexa-accent font-medium text-white"
        >
          Book this service
        </Link>
      </div>

      <section className="rounded-xl bg-white p-4 shadow-sm">
        <h2 className="text-sm font-semibold uppercase text-slate-500">Ratings</h2>
        <div className="mt-3">
          <ServiceRatingSummary summary={service.rating_summary} showBreakdown />
        </div>
      </section>

      {service.reviews?.length > 0 && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Customer comments</h2>
          <ul className="mt-3 space-y-4">
            {service.reviews.map((review) => (
              <li
                key={review.id}
                className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-slate-800">
                    {review.customer_name}
                  </span>
                  <span className="text-sm font-medium text-amber-500">
                    ★ {review.average}
                  </span>
                </div>
                <ReviewDimensionBreakdown review={review} />
                {review.comment ? (
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{review.comment}</p>
                ) : (
                  <p className="mt-2 text-sm italic text-slate-400">No written comment.</p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {message && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
      )}
      {error && service && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {service.can_rate && (
        <section className="rounded-xl bg-violet-50 p-4 ring-1 ring-violet-100">
          <h2 className="font-semibold text-slate-900">Rate this service</h2>
          <p className="mt-1 text-sm text-slate-600">
            You completed a booking for this service. Share your rating and a comment.
          </p>
          <div className="mt-4">
            <ServiceRatingForm onSubmit={submitReview} submitting={submittingReview} />
          </div>
        </section>
      )}

      {service.my_review && !service.can_rate && (
        <section className="rounded-xl bg-white p-4 shadow-sm">
          <h2 className="text-sm font-semibold uppercase text-slate-500">Your rating</h2>
          <p className="mt-2 text-sm font-medium text-amber-500">
            ★ {service.my_review.average} average
          </p>
          <ReviewDimensionBreakdown review={service.my_review} />
          {service.my_review.comment ? (
            <p className="mt-2 text-sm text-slate-700">{service.my_review.comment}</p>
          ) : (
            <p className="mt-2 text-sm italic text-slate-400">You did not leave a comment.</p>
          )}
        </section>
      )}

      {!service.can_rate && !service.my_review && isAuthenticated && (
        <p className="text-sm text-slate-500">
          You can rate and comment on this service after a completed booking.
        </p>
      )}
    </div>
  );
}
