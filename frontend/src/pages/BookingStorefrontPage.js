import React, { useCallback, useEffect, useState } from 'react';
import { Link, useLocation, useOutletContext, useParams } from 'react-router-dom';
import { policyLabel } from '../constants/bookingPolicies';
import ProviderProfileEditor from '../components/provider/ProviderProfileEditor';
import ProviderServicesEditor from '../components/provider/ProviderServicesEditor';
import CustomerServiceRequestForm from '../components/customer/CustomerServiceRequestForm';
import { useAuth } from '../contexts/AuthContext';
import { businessesAPI } from '../utils/api';
import { bookService, businessPage, customerProviderService } from '../utils/customerPaths';
import { providerRouteKey } from '../utils/providerRouteKey';
import { providerServices } from '../utils/providerPaths';
import ExpandableText from '../components/ui/ExpandableText';
import ServiceCategoryBrowse from '../components/services/ServiceCategoryBrowse';
import { buildCatalogFromFlat } from '../components/services/ServiceCatalogView';
import {
  customerConnectionState,
  getCustomerMembership,
  isOrgStaff,
  needsExplicitConnect,
} from '../utils/bookingAccess';
import { providerHome, providerSchedule } from '../utils/providerPaths';
import { formatProviderServiceArea, providerHasServiceArea } from '../utils/serviceArea';

/**
 * Public booking profile at /book/:slug
 * variant from BookRouteLayout: guest | customer | owner
 */
export default function BookingStorefrontPage() {
  const { variant = 'customer' } = useOutletContext() || {};
  const params = useParams();
  const location = useLocation();
  const providerKey = providerRouteKey(params);
  const businessSlug = providerKey;
  const isCustomerProviderRoute = location.pathname.startsWith('/customer/provider/');
  const isOwnerView = variant === 'owner';
  const isGuest = variant === 'guest';
  const { memberships, refreshSession } = useAuth();
  const staffOfOrg = isOrgStaff(memberships, businessSlug);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState(null);
  const [editing, setEditing] = useState(false);
  const membership = getCustomerMembership(memberships, businessSlug);
  const bookingPolicy = data?.booking_policy;
  const connection = customerConnectionState(bookingPolicy, membership);
  const mustConnect = !isOwnerView && needsExplicitConnect(bookingPolicy) && connection === 'disconnected';
  const canPickService = !isOwnerView && !mustConnect;

  const load = useCallback(() => {
    if (!businessSlug) return;
    setLoading(true);
    setError(null);
    businessesAPI
      .getPublicStorefront(businessSlug)
      .then((res) => setData(res.data))
      .catch(() => setError('Provider not found.'))
      .finally(() => setLoading(false));
  }, [businessSlug]);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async () => {
    setConnecting(true);
    setMessage(null);
    try {
      await businessesAPI.connectToOrg(businessSlug);
      await refreshSession();
      setMessage(
        bookingPolicy === 'clients_only'
          ? 'Access request sent. Once the business approves you, you can book a slot.'
          : 'Ready to book — choose a service below.'
      );
    } catch (e) {
      setError(e.response?.data?.detail || 'Could not connect.');
    } finally {
      setConnecting(false);
    }
  };

  const finishEditing = () => {
    setEditing(false);
    load();
  };

  if (loading && !data) {
    return <p className="text-center text-slate-500 py-8">Loading…</p>;
  }

  if (error || !data) {
    return (
      <div className="py-8 text-center">
        <p className="text-red-700">{error || 'Not found'}</p>
      </div>
    );
  }

  const { organization, services } = data;
  const customerKey = organization.public_ref || providerKey;
  const adminOrgSlug = organization.slug || providerKey;
  const serviceBookPath = (serviceId) =>
    isCustomerProviderRoute
      ? customerProviderService(customerKey, serviceId)
      : bookService(customerKey, serviceId);
  const providerPagePath = isCustomerProviderRoute
    ? `/customer/provider/${customerKey}`
    : businessPage(customerKey);
  const serviceCatalog =
    data.service_catalog || buildCatalogFromFlat(services || []);
  const hasListedServices = (services || []).length > 0;
  const gallery = organization.gallery || [];
  const businessTypes = data.business_types || [];
  const forceShowPrice = isOwnerView;

  const renderCatalogActions = (svc) => {
    if (isOwnerView) return null;
    if (isGuest) {
      return (
        <Link
          to={`/login?next=${encodeURIComponent(serviceBookPath(svc.id))}`}
          className="rounded-lg bg-luminexa-accent px-3 py-2 text-xs font-medium text-white"
        >
          Sign in to book
        </Link>
      );
    }
    if (mustConnect) {
      return (
        <button
          type="button"
          disabled={connecting}
          onClick={connect}
          className="rounded-lg border border-luminexa-accent px-3 py-2 text-xs font-medium text-luminexa-accent disabled:opacity-60"
        >
          Request access
        </button>
      );
    }
    if (canPickService) {
      return (
        <Link
          to={serviceBookPath(svc.id)}
          className="rounded-lg bg-luminexa-accent px-3 py-2 text-xs font-medium text-white"
        >
          Book
        </Link>
      );
    }
    return null;
  };

  const shellClass =
    variant === 'customer' ? '-mx-4 -mt-2 space-y-4 sm:mx-0 sm:mt-0' : 'space-y-5';

  return (
    <div className={shellClass}>
      <div className="relative -mx-4 h-44 overflow-hidden bg-gradient-to-br from-luminexa-accent/30 to-slate-200 sm:mx-0 sm:rounded-t-xl">
        {organization.banner_url && (
          <img src={organization.banner_url} alt="" className="h-full w-full object-cover" />
        )}
        {organization.logo_url && (
          <img
            src={organization.logo_url}
            alt=""
            className="absolute bottom-3 left-4 h-16 w-16 rounded-xl border-2 border-white bg-white object-cover shadow-md"
          />
        )}
        {isOwnerView && (
          <div className="absolute right-3 top-3 flex gap-2">
            {editing ? (
              <button
                type="button"
                onClick={finishEditing}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-900 shadow"
              >
                Done editing
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-lg bg-luminexa-accent px-3 py-2 text-sm font-medium text-white shadow"
              >
                Edit page
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-5 pt-4">
        {!isOwnerView && staffOfOrg && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-medium">You manage this business</p>
            <p className="mt-1 text-amber-800">
              This page is what customers see when booking. Use your dashboard to run the business,
              or switch to owner preview to edit this page.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link
                to={providerHome(adminOrgSlug)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-luminexa-accent px-4 text-sm font-medium text-white"
              >
                Business dashboard
              </Link>
              <Link
                to={`${businessPage(adminOrgSlug)}?mode=owner`}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-amber-200 bg-white px-4 text-sm font-medium text-amber-900"
              >
                Edit public page
              </Link>
            </div>
          </div>
        )}

        {isOwnerView && !editing && (
          <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <p className="font-medium">Your public booking page</p>
            <p className="mt-1 text-violet-800">
              This is what customers see at your shared link. Use <strong>Edit page</strong> to update
              your description, logo, and services.
            </p>
            <div className="mt-3 flex flex-col gap-2 sm:flex-row">
              <Link
                to={providerServices(adminOrgSlug)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg bg-luminexa-accent px-4 text-sm font-medium text-white"
              >
                Manage categories &amp; services
              </Link>
              <Link
                to={providerSchedule(adminOrgSlug)}
                className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-lg border border-violet-200 bg-white px-4 text-sm font-medium text-luminexa-accent"
              >
                Dashboard
              </Link>
            </div>
          </div>
        )}

        {editing ? (
          <div className="space-y-4">
            <ProviderProfileEditor orgSlug={adminOrgSlug} onMediaChange={load} />
            <ProviderServicesEditor orgSlug={adminOrgSlug} />
          </div>
        ) : (
          <>
            <header>
              <h1 className="text-2xl font-bold text-slate-900">{organization.name}</h1>
              {organization.tagline && (
                <p className="mt-1 text-slate-600">{organization.tagline}</p>
              )}
              {providerHasServiceArea(organization) && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-slate-600">
                  <span aria-hidden>📍</span>
                  <span>{formatProviderServiceArea(organization)}</span>
                </p>
              )}
              {isOwnerView && bookingPolicy && (
                <p className="mt-2 text-xs text-slate-500">{policyLabel(bookingPolicy)}</p>
              )}
            </header>

            {isGuest && (
              <section className="rounded-xl bg-white p-5 shadow-sm">
                <h2 className="font-semibold text-slate-900">Book with us</h2>
                <p className="mt-2 text-sm text-slate-600">Sign in to view times and book.</p>
                <div className="mt-4 flex flex-col gap-2">
                  <Link
                    to={`/login?next=${encodeURIComponent(providerPagePath)}`}
                    className="flex min-h-[48px] items-center justify-center rounded-xl bg-luminexa-accent font-medium text-white"
                  >
                    Sign in to book
                  </Link>
                  <Link
                    to={`/register?next=${encodeURIComponent(providerPagePath)}`}
                    className="flex min-h-[48px] items-center justify-center rounded-xl border border-slate-200 text-slate-700"
                  >
                    Create account
                  </Link>
                </div>
              </section>
            )}

            {!isGuest && mustConnect && (
              <section className="rounded-xl bg-violet-50 p-4 ring-1 ring-violet-100">
                <p className="text-sm font-medium text-violet-900">Request access before booking</p>
                <p className="mt-1 text-sm text-violet-800">
                  This business reviews customers before they can choose and book a slot.
                </p>
                <button
                  type="button"
                  disabled={connecting}
                  onClick={connect}
                  className="mt-3 w-full min-h-[44px] rounded-lg bg-luminexa-accent font-medium text-white disabled:opacity-60"
                >
                  {connecting ? 'Sending request…' : 'Request access'}
                </button>
              </section>
            )}

            {message && (
              <p className="rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{message}</p>
            )}
            {error && (
              <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
            )}

            {(isOwnerView || hasListedServices) && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500">
                Choose a category
              </h2>
              {!hasListedServices ? (
                <div className="rounded-xl border border-dashed border-slate-200 bg-white p-6 text-center">
                  <p className="text-sm text-slate-500">
                    No services on your public page yet. Add categories and services from the
                    Services menu.
                  </p>
                  <Link
                    to={providerServices(adminOrgSlug)}
                    className="mt-3 inline-block text-sm font-medium text-luminexa-accent"
                  >
                    Manage services
                  </Link>
                </div>
              ) : (
                <ServiceCategoryBrowse
                  catalog={serviceCatalog}
                  orgSlug={businessSlug}
                  forceShowPrice={forceShowPrice}
                  renderServiceActions={renderCatalogActions}
                />
              )}
            </section>
            )}

            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase text-slate-500">About</h2>
              {organization.description ? (
                <ExpandableText
                  text={organization.description}
                  className="mt-2 text-sm text-slate-700"
                  clampClass="line-clamp-3"
                  maxChars={200}
                />
              ) : (
                <p className="mt-2 text-sm italic text-slate-400">
                  {isOwnerView
                    ? 'No description yet — tap Edit page to add one.'
                    : 'No description provided.'}
                </p>
              )}
            </section>

            {gallery.length > 0 && (
              <section className="rounded-xl bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold uppercase text-slate-500">Gallery</h2>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {gallery.map((img) => (
                    <figure key={img.id} className="overflow-hidden rounded-lg">
                      <img
                        src={img.image_url}
                        alt={img.caption || organization.name}
                        className="aspect-square w-full object-cover"
                      />
                    </figure>
                  ))}
                </div>
              </section>
            )}

            {!isOwnerView && (
              <CustomerServiceRequestForm
                orgSlug={customerKey}
                businessTypes={businessTypes}
                isGuest={isGuest}
                loginNextUrl={providerPagePath}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}
