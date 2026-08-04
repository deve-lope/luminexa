import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import ServicePictureCarousel from '../../components/services/ServicePictureCarousel';
import ServiceRatingForm from '../../components/services/ServiceRatingForm';
import ServiceRatingSummary from '../../components/services/ServiceRatingSummary';
import StarRating from '../../components/services/StarRating';
import { useAuth } from '../../contexts/AuthContext';
import { businessesAPI } from '../../utils/api';
import {
  bookService,
  businessPage,
  customerProviderPage,
  customerProviderService,
} from '../../utils/customerPaths';
import { providerRouteKey } from '../../utils/providerRouteKey';
import { formatServiceMeta } from '../../utils/serviceDisplay';

const COMMENT_PREVIEW = 2;

export default function CustomerServiceDetailPage() {
  const params = useParams();
  const location = useLocation();
  const { variant = 'customer' } = useOutletContext() || {};
  const isOwnerView = variant === 'owner';
  const providerKey = providerRouteKey(params);
  const isCustomerProviderRoute = location.pathname.startsWith('/customer/provider/');
  const { serviceId } = params;
  const { isAuthenticated } = useAuth();
  const [service, setService] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [editingReview, setEditingReview] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await businessesAPI.getServiceDetail(providerKey, serviceId);
      setService(data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Service not found.');
      setService(null);
    } finally {
      setLoading(false);
    }
  }, [providerKey, serviceId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setEditingReview(false);
    setShowAllComments(false);
  }, [serviceId]);

  const submitReview = async (payload) => {
    setSubmittingReview(true);
    setMessage(null);
    setError(null);
    try {
      await businessesAPI.submitServiceReview(providerKey, serviceId, payload);
      setMessage(editingReview ? 'Your rating was updated.' : 'Thank you for your rating!');
      setEditingReview(false);
      await load();
    } catch (err) {
      setError(
        err.response?.data?.detail
          || (typeof err.response?.data === 'string' ? err.response.data : null)
          || 'Could not submit rating.',
      );
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

  const commentReviews = useMemo(() => {
    if (!service?.reviews?.length) return [];
    return service.reviews.filter((r) => r.comment?.trim());
  }, [service]);

  const visibleComments = showAllComments
    ? commentReviews
    : commentReviews.slice(0, COMMENT_PREVIEW);

  if (loading) {
    return <p className="py-8 text-center text-slate-500">Loading service…</p>;
  }

  const customerKey = service?.organization_public_ref || providerKey;
  const providerPath = isCustomerProviderRoute
    ? customerProviderPage(customerKey)
    : businessPage(customerKey);
  const providerBackPath = (() => {
    const cat = new URLSearchParams(location.search).get('cat');
    const base = cat
      ? `${providerPath}?cat=${encodeURIComponent(cat)}`
      : providerPath;
    const sid = service?.id || serviceId;
    return sid ? `${base}#service-${sid}` : base;
  })();
  const bookPath = isCustomerProviderRoute
    ? customerProviderService(customerKey, service?.id)
    : bookService(customerKey, service?.id);

  if (error && !service) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-600">{error}</p>
        <Link to={providerPath} className="mt-4 inline-block text-luminexa-accent">
          Back to business
        </Link>
      </div>
    );
  }

  const meta = formatServiceMeta(service);
  const myReview = service.my_review;
  const canEdit = Boolean(service.can_edit_review || myReview);

  return (
    <div className="space-y-6">
      <header>
        <Link
          to={providerBackPath}
          replace
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

      <section className="lx-card">
        <h2 className="lx-eyebrow">About this service</h2>
        {service.description ? (
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-700">
            {service.description}
          </p>
        ) : (
          <p className="mt-3 text-sm italic text-slate-400">No description provided.</p>
        )}
      </section>

      <div className="sticky bottom-[4.75rem] z-10 -mx-0 border-t border-slate-200/80 bg-white/95 py-3 backdrop-blur-xl sm:static sm:border-0 sm:bg-transparent sm:py-0 lg:bottom-0">
        {isOwnerView ? (
          <p className="text-center text-sm text-slate-600">
            This is how customers book — share your{' '}
            <Link to={providerPath} className="lx-link">
              booking page
            </Link>{' '}
            link for them to schedule.
          </p>
        ) : (
          <Link to={bookPath} className="lx-btn-primary w-full min-h-[48px]">
            Book this service
          </Link>
        )}
      </div>

      {message && (
        <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
      )}
      {error && service && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}

      {service.can_rate && (
        <section className="rounded-2xl bg-gradient-to-br from-violet-50 to-violet-100 p-4 ring-1 ring-violet-100/80">
          <h2 className="font-semibold text-slate-900">Rate this service</h2>
          <p className="mt-1 text-sm text-slate-600">
            You completed a booking for this service. Share your rating and a comment.
          </p>
          <div className="mt-4">
            <ServiceRatingForm onSubmit={submitReview} submitting={submittingReview} />
          </div>
        </section>
      )}

      {myReview && !service.can_rate && (
        <section className="lx-card">
          <div className="flex items-start justify-between gap-3">
            <h2 className="lx-eyebrow">Your rating</h2>
            {canEdit && !editingReview && (
              <button
                type="button"
                onClick={() => {
                  setMessage(null);
                  setError(null);
                  setEditingReview(true);
                }}
                className="shrink-0 text-sm font-medium text-luminexa-accent"
              >
                Edit rating
              </button>
            )}
          </div>

          {editingReview ? (
            <div className="mt-3">
              <ServiceRatingForm
                key={`edit-${myReview.id}`}
                onSubmit={submitReview}
                submitting={submittingReview}
                initialValues={myReview}
                submitLabel="Save rating"
                onCancel={() => setEditingReview(false)}
              />
            </div>
          ) : (
            <>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <StarRating value={myReview.average} size="lg" />
                <span className="text-sm font-medium text-amber-800">
                  {myReview.average}
                </span>
              </div>
              {myReview.comment ? (
                <p className="mt-3 text-sm leading-relaxed text-slate-700">{myReview.comment}</p>
              ) : null}
            </>
          )}
        </section>
      )}

      {!service.can_rate && !myReview && isAuthenticated && !isOwnerView && (
        <p className="text-sm text-slate-500">
          You can rate and comment on this service after a completed booking.
        </p>
      )}

      <section className="lx-card">
        <h2 className="lx-eyebrow">Ratings</h2>
        <div className="mt-3">
          <ServiceRatingSummary summary={service.rating_summary} showBreakdown />
        </div>
      </section>

      <section className="lx-card">
        <h2 className="lx-eyebrow">Comments</h2>
        {commentReviews.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No comments yet.</p>
        ) : (
          <>
            <ul className="mt-3 space-y-4">
              {visibleComments.map((review) => (
                <li
                  key={review.id}
                  className="border-b border-slate-100 pb-4 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-slate-800">
                      {review.customer_name}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <StarRating value={review.average} size="sm" />
                      <span className="text-sm font-medium text-amber-700">{review.average}</span>
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{review.comment}</p>
                </li>
              ))}
            </ul>
            {commentReviews.length > COMMENT_PREVIEW && (
              <button
                type="button"
                onClick={() => setShowAllComments((v) => !v)}
                className="mt-3 text-sm font-medium text-luminexa-accent"
              >
                {showAllComments ? 'Show less' : `Show all (${commentReviews.length})`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  );
}
