import React from 'react';
import { createPortal } from 'react-dom';
import { useModalBodyLock } from '../../hooks/useModalBodyLock';
import { useOverlayHistoryBack } from '../../hooks/useOverlayHistoryBack';

/**
 * Preview CSV import: count + sample rows + errors with fix hints, then Confirm.
 */
export default function CustomerImportConfirmModal({
  open,
  preview,
  fileName,
  busy = false,
  onConfirm,
  onClose,
}) {
  useModalBodyLock(open && Boolean(preview));
  useOverlayHistoryBack(open && Boolean(preview), onClose);

  if (!open || !preview) return null;

  const ready = preview.ready_count || 0;
  const canImport = Boolean(preview.can_import) && ready > 0;
  const errors = Array.isArray(preview.errors) ? preview.errors : [];
  const sample = Array.isArray(preview.preview) ? preview.preview : [];

  const dialog = (
    <div
      className="lx-modal-overlay fixed inset-0 z-[140] flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Confirm customer import"
      onClick={() => !busy && onClose?.()}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl bg-white p-5 shadow-lx-elevated sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold text-slate-900">Import customers?</h2>
        {fileName ? (
          <p className="mt-1 truncate text-xs text-slate-500">{fileName}</p>
        ) : null}

        <p className="mt-3 text-sm text-slate-700">
          Found <span className="font-semibold text-slate-900">{ready}</span> customer
          {ready === 1 ? '' : 's'} ready to import
          {preview.will_create || preview.will_link ? (
            <>
              {' '}
              ({preview.will_create || 0} new
              {preview.will_link ? `, ${preview.will_link} already on Luminexa` : ''})
            </>
          ) : null}
          .
        </p>
        <p className="mt-1 text-xs text-slate-500">
          No invite emails will be sent. They can sign in later with their email.
        </p>

        {sample.length > 0 ? (
          <ul className="mt-3 max-h-36 space-y-1.5 overflow-y-auto rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
            {sample.map((row) => (
              <li key={row.email} className="flex justify-between gap-2">
                <span className="min-w-0 truncate font-medium">
                  {row.full_name || row.email}
                </span>
                <span className="shrink-0 text-slate-400">
                  {row.action === 'link' ? 'link' : 'new'}
                </span>
              </li>
            ))}
            {ready > sample.length ? (
              <li className="text-slate-400">…and {ready - sample.length} more</li>
            ) : null}
          </ul>
        ) : null}

        {errors.length > 0 ? (
          <div className="mt-4 rounded-xl bg-amber-50 px-3 py-3 ring-1 ring-amber-100">
            <p className="text-sm font-semibold text-amber-900">
              {preview.error_count || errors.length} row
              {(preview.error_count || errors.length) === 1 ? '' : 's'} will be skipped
            </p>
            <ul className="mt-2 space-y-2 text-xs text-amber-900/90">
              {errors.slice(0, 6).map((err) => (
                <li key={`${err.row}-${err.email}-${err.detail}`}>
                  <span className="font-medium">
                    Row {err.row}
                    {err.email ? ` (${err.email})` : ''}:
                  </span>{' '}
                  {err.detail}
                  {err.fix ? (
                    <span className="mt-0.5 block text-amber-800/80">Fix: {err.fix}</span>
                  ) : null}
                </li>
              ))}
            </ul>
            {(preview.error_count || 0) > 6 ? (
              <p className="mt-2 text-xs text-amber-800/70">
                +{(preview.error_count || 0) - 6} more — fix those rows in Excel and re-upload.
              </p>
            ) : null}
          </div>
        ) : null}

        {!canImport ? (
          <p className="mt-4 text-sm text-red-700">
            Nothing valid to import. Fix the issues above, or download the CSV template and try
            again.
          </p>
        ) : null}

        <div className="mt-5 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="min-h-[48px] flex-1 rounded-xl border border-slate-200 bg-white text-sm font-medium text-slate-700"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !canImport}
            onClick={onConfirm}
            className="lx-btn-primary min-h-[48px] flex-1 disabled:opacity-50"
          >
            {busy ? 'Importing…' : `Confirm import (${ready})`}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(dialog, document.body);
}
