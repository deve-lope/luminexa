import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import ProviderProfileEditor from '../../components/provider/ProviderProfileEditor';
import ProviderStorefrontPreview from '../../components/provider/ProviderStorefrontPreview';
import ProviderServicesPage from './ProviderServicesPage';
import { businessesAPI, jobsAPI } from '../../utils/api';
import { getCustomerBookingUrl } from '../../utils/bookingLink';
import { providerSchedule, providerSettings } from '../../utils/providerPaths';
import { providerHasServiceArea } from '../../utils/serviceArea';

export default function ProviderSharePage() {
  const { orgSlug, activeOrg } = useProviderOrg();
  const { memberships } = useAuth();
  const isOwner = useMemo(
    () => memberships?.some((m) => m.organization_slug === orgSlug && m.role === 'owner'),
    [memberships, orgSlug]
  );
  const [editing, setEditing] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [staffEmail, setStaffEmail] = useState('');
  const [staffMessage, setStaffMessage] = useState(null);
  const [invitingStaff, setInvitingStaff] = useState(false);
  const bookingUrl = useMemo(() => getCustomerBookingUrl(orgSlug), [orgSlug]);

  const loadPreview = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    businessesAPI
      .getPublicStorefront(orgSlug)
      .then((res) => setData(res.data))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [orgSlug]);

  useEffect(() => {
    loadPreview();
  }, [loadPreview]);

  const finishEditing = () => {
    setEditing(false);
    loadPreview();
  };

  const copyBookingLink = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
    } catch {
      const input = document.createElement('textarea');
      input.value = bookingUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  if (!orgSlug) {
    return <p className="text-slate-500">Select a business to get your link.</p>;
  }

  return (
    <div className="space-y-6">
      {!editing && (
        <>
          <section className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
            <p className="font-medium">My page</p>
            <p className="mt-1 text-violet-800">
              This is what customers see — cover photo, bio, and services by category. Tap{' '}
              <strong>Edit page</strong> to change appearance and services.
            </p>
          </section>
          {!providerHasServiceArea(data?.organization) && (
            <section className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              <p className="font-medium">Set your service area</p>
              <p className="mt-1 text-amber-800">
                Customers search by PIN / postal code. Add where you operate in{' '}
                <Link to={providerSettings(orgSlug)} className="font-semibold text-amber-900 underline">
                  Settings
                </Link>
                .
              </p>
            </section>
          )}
        </>
      )}

      {editing ? (
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-white p-4 shadow-sm">
            <div>
              <h2 className="font-semibold text-slate-900">Edit public page</h2>
              <p className="mt-1 text-sm text-slate-600">
                Update cover, logo, bio, location, gallery, categories, and services.
              </p>
            </div>
            <button
              type="button"
              onClick={finishEditing}
              className="min-h-[44px] rounded-xl bg-luminexa-accent px-5 text-sm font-medium text-white"
            >
              Done editing
            </button>
          </div>

          <ProviderProfileEditor orgSlug={orgSlug} onMediaChange={loadPreview} />

          <div>
            <h2 className="text-sm font-semibold uppercase text-slate-500">Categories &amp; services</h2>
            <p className="mt-1 text-sm text-slate-600">
              Organize offerings under categories. Each service appears on your customer booking
              page.
            </p>
            <div className="mt-4">
              <ProviderServicesPage embedded />
            </div>
          </div>
        </div>
      ) : (
        <ProviderStorefrontPreview
          data={data}
          loading={loading}
          orgSlug={orgSlug}
          onEdit={() => setEditing(true)}
        />
      )}

      {!editing && (
        <>
          <section className="rounded-xl bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold uppercase text-slate-500">Customer link</h2>
            <p className="mt-1 text-sm text-slate-600">
              Send this link so customers can view your page, connect, and book appointments.
            </p>
            <div className="mt-4 flex gap-2">
              <input
                type="text"
                readOnly
                value={bookingUrl}
                className="min-h-[48px] flex-1 truncate rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm"
              />
              <button
                type="button"
                onClick={copyBookingLink}
                className="min-h-[48px] shrink-0 rounded-xl bg-luminexa-accent px-4 font-medium text-white"
              >
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
            <a
              href={bookingUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex min-h-[44px] items-center text-sm font-medium text-luminexa-accent"
            >
              Open live booking page
            </a>
            <p className="mt-4 text-xs text-slate-500">
              Booking rules are in{' '}
              <Link to={providerSettings(orgSlug)} className="font-medium text-luminexa-accent">
                Settings
              </Link>
              . Approve customers on{' '}
              <Link to={providerSchedule(orgSlug)} className="font-medium text-luminexa-accent">
                Schedule
              </Link>
              .
            </p>
          </section>

          {isOwner && (
            <section className="rounded-xl bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold uppercase text-slate-500">Invite staff</h2>
              <p className="mt-1 text-sm text-slate-600">
                Add team members who can manage schedule and bookings for{' '}
                {activeOrg?.organization_name}.
              </p>
              <div className="mt-4 flex gap-2">
                <input
                  type="email"
                  value={staffEmail}
                  onChange={(e) => setStaffEmail(e.target.value)}
                  placeholder="colleague@email.com"
                  className="min-h-[48px] flex-1 rounded-xl border border-slate-200 px-3 text-sm"
                />
                <button
                  type="button"
                  disabled={invitingStaff || !staffEmail.trim()}
                  onClick={async () => {
                    setInvitingStaff(true);
                    setStaffMessage(null);
                    try {
                      const res = await jobsAPI.inviteStaff(orgSlug, staffEmail.trim());
                      setStaffMessage(res.data?.detail || 'Invitation sent.');
                      setStaffEmail('');
                    } catch (err) {
                      setStaffMessage(
                        err.response?.data?.email?.[0] ||
                          err.response?.data?.detail ||
                          'Could not send invitation.'
                      );
                    } finally {
                      setInvitingStaff(false);
                    }
                  }}
                  className="min-h-[48px] shrink-0 rounded-xl bg-slate-800 px-4 font-medium text-white disabled:opacity-60"
                >
                  {invitingStaff ? 'Sending…' : 'Invite'}
                </button>
              </div>
              {staffMessage && <p className="mt-2 text-sm text-slate-600">{staffMessage}</p>}
            </section>
          )}
        </>
      )}
    </div>
  );
}
