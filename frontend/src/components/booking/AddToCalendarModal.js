import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { jobsAPI } from '../../utils/api';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { calendarProviderOptions } from '../../utils/addToCalendar';

async function downloadIcsFile(bookingId, filename = 'luminexa-booking.ics') {
  const res = await jobsAPI.downloadBookingIcal(bookingId);
  const blob = res.data instanceof Blob
    ? res.data
    : new Blob([res.data], { type: 'text/calendar;charset=utf-8' });
  // Guard against HTML error/login pages being saved as "calendar" files.
  if (blob.type && blob.type.includes('html')) {
    throw new Error('Calendar file was not available. Try Google or Outlook instead.');
  }
  const textProbe = await blob.slice(0, 32).text();
  if (textProbe.trimStart().toLowerCase().startsWith('<!DOCTYPE') || textProbe.trimStart().startsWith('<html')) {
    throw new Error('Calendar file was not available. Try Google or Outlook instead.');
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function AddToCalendarModal({ open, booking, onClose }) {
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  useModalBodyLock(open && Boolean(booking));

  useEffect(() => {
    if (!open) return undefined;
    setError(null);
    setBusyId(null);
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open || !booking) return null;

  const options = calendarProviderOptions(booking, '#');
  const ref = booking.reference || (booking.id != null ? `BK-${String(booking.id).padStart(5, '0')}` : 'booking');

  const handleOption = async (opt) => {
    setError(null);
    if (opt.download) {
      setBusyId(opt.id);
      try {
        await downloadIcsFile(booking.id, `luminexa-${ref}.ics`);
        onClose?.();
      } catch (e) {
        setError(e?.message || 'Could not download calendar file.');
      } finally {
        setBusyId(null);
      }
      return;
    }
    if (opt.external && opt.href) {
      window.open(opt.href, '_blank', 'noopener,noreferrer');
      onClose?.();
    }
  };

  const dialog = (
    <div
      className="lx-modal-overlay fixed inset-0 z-[110] flex items-end justify-center bg-slate-900/40 sm:items-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-to-calendar-title"
      onClick={() => onClose?.()}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white p-5 shadow-lx-elevated"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 id="add-to-calendar-title" className="text-lg font-semibold tracking-tight text-slate-900">
              Add to calendar
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Save this appointment to Google, Apple, Outlook, or download a calendar file.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <ul className="mt-4 space-y-2">
          {options.map((opt) => (
            <li key={opt.id}>
              <button
                type="button"
                disabled={Boolean(busyId)}
                onClick={() => handleOption(opt)}
                className="flex min-h-[48px] w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm font-semibold text-slate-800 transition hover:border-teal-200 hover:bg-teal-50/60 disabled:opacity-60"
              >
                <span>{busyId === opt.id ? 'Downloading…' : opt.label}</span>
                <span className="text-slate-400" aria-hidden>
                  →
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
