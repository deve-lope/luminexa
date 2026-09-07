import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { useOverlayHistoryBack } from '../../hooks/useOverlayHistoryBack';
import { userAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

export const SAFETY_REPORT_REASONS = [
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'harassment', label: 'Harassment or threats' },
  { value: 'inappropriate', label: 'Inappropriate content or behavior' },
  { value: 'spam', label: 'Spam' },
  { value: 'safety', label: 'Safety concern' },
  { value: 'other', label: 'Other' },
];

/**
 * In-app report form (reason + free text) for customers and providers.
 * Props: organizationSlug, reportedUserId (provider→customer), conversationId, peerLabel, onClose, onSubmitted
 */
export default function ReportUserModal({
  open,
  onClose,
  organizationSlug,
  reportedUserId = null,
  conversationId = null,
  peerLabel = 'this account',
  onSubmitted,
}) {
  const [reason, setReason] = useState('scam');
  const [detail, setDetail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useModalBodyLock(open);
  useOverlayHistoryBack(open, onClose);

  useEffect(() => {
    if (!open) return;
    setReason('scam');
    setDetail('');
    setBusy(false);
    setError('');
    setDone(false);
  }, [open]);

  if (!open) return null;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      await userAPI.createSafetyReport({
        organization_slug: organizationSlug,
        reason,
        detail: detail.trim(),
        ...(reportedUserId != null ? { reported_user_id: reportedUserId } : {}),
        ...(conversationId != null ? { conversation_id: conversationId } : {}),
      });
      setDone(true);
      onSubmitted?.();
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const dialog = (
    <div
      className="lx-modal-overlay fixed inset-0 z-[140] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Report"
      onClick={() => !busy && onClose?.()}
    >
      <div
        className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lx-elevated sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        {done ? (
          <>
            <h2 className="text-lg font-semibold text-slate-900">Report received</h2>
            <p className="mt-2 text-sm text-slate-600">
              Thanks. Our team will review this and take action if needed. The other party
              will not see who filed the report.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="lx-btn-primary mt-5 w-full min-h-[48px]"
            >
              Done
            </button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">Report {peerLabel}</h2>
              <p className="mt-1 text-sm text-slate-600">
                Tell us what happened. Reports go to Luminexa for review — we may remove or
                pause accounts that break our rules.
              </p>
            </div>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Reason
              </span>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="lx-input mt-1.5 w-full"
                required
              >
                {SAFETY_REPORT_REASONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                What happened
              </span>
              <textarea
                value={detail}
                onChange={(e) => setDetail(e.target.value)}
                rows={5}
                maxLength={2000}
                required
                minLength={20}
                placeholder="Please include enough detail for us to review (min 20 characters)."
                className="lx-input mt-1.5 w-full resize-y"
              />
              <span className="mt-1 block text-right text-xs text-slate-400">
                {detail.trim().length}/2000
              </span>
            </label>

            {error ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
            ) : null}

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={busy || detail.trim().length < 20}
                className="lx-btn-primary min-h-[48px] flex-1 disabled:opacity-50"
              >
                {busy ? 'Sending…' : 'Submit report'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
