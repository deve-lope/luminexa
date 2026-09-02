import React, { useCallback, useEffect, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import { normalizeExternalWebsiteUrl } from '../../utils/openExternalWebsite';
import parseApiError from '../../utils/parseApiError';

/**
 * Optional link to the provider’s own website (shown on their public booking page).
 */
export default function ProviderWebsiteSettings({ orgSlug, isOwner, embedded = false }) {
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const fetchOrg = useCallback(async () => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    try {
      const res = await jobsAPI.getOrganization(orgSlug);
      setWebsiteUrl(res.data?.external_website_url || '');
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setLoading(false);
    }
  }, [orgSlug]);

  useEffect(() => {
    fetchOrg();
  }, [fetchOrg]);

  const save = async () => {
    if (!isOwner) return;
    setSaving(true);
    setMessage('');
    setError('');
    const trimmed = websiteUrl.trim();
    const normalized = trimmed ? normalizeExternalWebsiteUrl(trimmed) : '';
    if (trimmed && !normalized) {
      setError('Enter a valid website address (for example https://yourbusiness.com).');
      setSaving(false);
      return;
    }
    try {
      await jobsAPI.patchOrganization(orgSlug, {
        external_website_url: normalized || '',
      });
      setWebsiteUrl(normalized || '');
      setMessage(normalized ? 'Website link saved.' : 'Website link removed.');
    } catch (e) {
      setError(parseApiError(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-slate-500">Loading website settings…</p>;
  }

  return (
    <section className={embedded ? 'space-y-4' : 'lx-card space-y-4'}>
      {!embedded && (
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Your website</h2>
          <p className="mt-1 text-sm text-slate-600">
            Optional link to your own site — not your Luminexa booking page.
          </p>
        </div>
      )}
      {embedded && (
        <p className="text-sm text-slate-600">
          Add a link to your existing website if you have one. Customers see a{' '}
          <span className="font-medium">Visit website</span> button on your public page, below your
          address.
        </p>
      )}

      <div>
        <label htmlFor="provider-external-website" className="block text-sm font-medium text-slate-700">
          Website URL
        </label>
        <input
          id="provider-external-website"
          type="url"
          inputMode="url"
          autoComplete="url"
          value={websiteUrl}
          disabled={!isOwner}
          onChange={(e) => setWebsiteUrl(e.target.value)}
          placeholder="https://yourbusiness.com"
          className="lx-input mt-1"
        />
        <p className="mt-1 text-xs text-slate-500">
          Leave blank to hide the button. We add https:// if you omit it.
        </p>
      </div>

      {isOwner ? (
        <button
          type="button"
          disabled={saving}
          onClick={save}
          className="lx-btn-primary w-full min-h-[48px]"
        >
          {saving ? 'Saving…' : 'Save website link'}
        </button>
      ) : (
        <p className="text-sm text-slate-500">Only the business owner can change this.</p>
      )}

      {message && <p className="text-sm text-emerald-700">{message}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
