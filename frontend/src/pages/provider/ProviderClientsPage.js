import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Skeleton from '../../components/Skeleton';
import CustomerImportConfirmModal from '../../components/provider/CustomerImportConfirmModal';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { providerClientDetail } from '../../utils/providerPaths';
import parseApiError from '../../utils/parseApiError';

const STATUS_TABS = ['approved', 'pending', 'blocked', 'all'];

export default function ProviderClientsPage() {
  const { orgSlug } = useProviderOrg();
  const [searchParams, setSearchParams] = useSearchParams();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [importBusy, setImportBusy] = useState(false);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [preview, setPreview] = useState(null);
  const [pendingFile, setPendingFile] = useState(null);
  const fileInputRef = useRef(null);
  const statusParam = searchParams.get('status');
  const status = STATUS_TABS.includes(statusParam) ? statusParam : 'approved';

  const load = useCallback(() => {
    if (!orgSlug) return;
    setLoading(true);
    setError('');
    jobsAPI
      .listOrgCustomers(orgSlug, { status })
      .then((res) => setCustomers(res.data || []))
      .catch((e) => setError(parseApiError(e)))
      .finally(() => setLoading(false));
  }, [orgSlug, status]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadTemplate = async () => {
    if (!orgSlug) return;
    try {
      const res = await jobsAPI.downloadCustomerImportTemplate(orgSlug);
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'luminexa-customers-import.csv';
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(parseApiError(e) || 'Could not download template.');
    }
  };

  const closePreview = () => {
    if (confirmBusy) return;
    setPreview(null);
    setPendingFile(null);
  };

  const onImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !orgSlug || importBusy || confirmBusy) return;
    setImportBusy(true);
    setImportResult(null);
    setError('');
    setPreview(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('dry_run', '1');
      const res = await jobsAPI.importOrgCustomers(orgSlug, formData);
      setPendingFile(file);
      setPreview(res.data || null);
    } catch (e) {
      const data = e?.response?.data;
      const fileMsg = data?.file;
      const msg = Array.isArray(fileMsg)
        ? fileMsg[0]
        : typeof fileMsg === 'string'
          ? fileMsg
          : parseApiError(e) || 'Could not read this CSV.';
      setError(msg);
      if (Array.isArray(data?.errors) && data.errors.length) {
        setPreview({
          ready_count: 0,
          will_create: 0,
          will_link: 0,
          will_skip: data.error_count || data.errors.length,
          can_import: false,
          errors: data.errors,
          error_count: data.error_count || data.errors.length,
          preview: [],
        });
        setPendingFile(null);
      }
    } finally {
      setImportBusy(false);
    }
  };

  const confirmImport = async () => {
    if (!orgSlug || !pendingFile || confirmBusy) return;
    setConfirmBusy(true);
    setError('');
    try {
      const formData = new FormData();
      formData.append('file', pendingFile);
      const res = await jobsAPI.importOrgCustomers(orgSlug, formData);
      setImportResult(res.data || null);
      setPreview(null);
      setPendingFile(null);
      load();
    } catch (e) {
      const data = e?.response?.data;
      const fileMsg = data?.file;
      setError(
        Array.isArray(fileMsg)
          ? fileMsg[0]
          : typeof fileMsg === 'string'
            ? fileMsg
            : parseApiError(e) || 'Import failed.',
      );
      if (Array.isArray(data?.errors) && data.errors.length) {
        setPreview((prev) => ({
          ...(prev || {}),
          ready_count: 0,
          can_import: false,
          errors: data.errors,
          error_count: data.error_count || data.errors.length,
        }));
      }
    } finally {
      setConfirmBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <p className="text-sm text-slate-600">
          Your customers, balances, and notes — open a client for history and invoices. Import a
          CSV from Excel if you already have a client list.
        </p>
        <div className="flex shrink-0 flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadTemplate}
            className="min-h-[40px] rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700"
          >
            Download CSV template
          </button>
          <button
            type="button"
            disabled={importBusy || confirmBusy}
            onClick={() => fileInputRef.current?.click()}
            className="min-h-[40px] rounded-xl bg-teal-700 px-3 text-sm font-medium text-white disabled:opacity-50"
          >
            {importBusy ? 'Checking file…' : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={onImportFile}
          />
        </div>
      </div>

      {importResult ? (
        <div className="rounded-2xl bg-teal-50 px-4 py-3 text-sm text-teal-900 ring-1 ring-teal-100">
          <p className="font-semibold">Import finished</p>
          <p className="mt-1">
            Created {importResult.created || 0}, linked existing {importResult.linked || 0},
            skipped {importResult.skipped || 0}.
            {importResult.error_count
              ? ` ${importResult.error_count} row issue(s).`
              : ' No invite emails were sent.'}
          </p>
          {Array.isArray(importResult.errors) && importResult.errors.length > 0 ? (
            <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-teal-800">
              {importResult.errors.slice(0, 5).map((err) => (
                <li key={`${err.row}-${err.email}`}>
                  Row {err.row}
                  {err.email ? ` (${err.email})` : ''}: {err.detail}
                  {err.fix ? ` — Fix: ${err.fix}` : ''}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="flex gap-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSearchParams(s === 'approved' ? {} : { status: s })}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold capitalize ${
              status === s ? 'bg-teal-700 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading ? (
        <Skeleton className="h-40 w-full rounded-2xl" />
      ) : !customers.length ? (
        <p className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-lx-soft ring-1 ring-slate-100">
          No customers in this list yet. Import a CSV or share your booking link.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-2xl bg-white shadow-lx-soft ring-1 ring-slate-100">
          {customers.map((c) => (
            <li key={c.id}>
              <Link
                to={providerClientDetail(orgSlug, c.id)}
                className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50"
              >
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900">
                    {c.full_name || c.email}
                  </p>
                  <p className="truncate text-xs text-slate-500">{c.email}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {c.cancel_count || 0} cancel{(c.cancel_count || 0) === 1 ? '' : 's'} ·{' '}
                    {c.no_show_count || 0} no-show{(c.no_show_count || 0) === 1 ? '' : 's'}
                  </p>
                </div>
                <span className="shrink-0 text-xs font-medium capitalize text-slate-400">
                  {c.customer_status || '—'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <CustomerImportConfirmModal
        open={Boolean(preview)}
        preview={preview}
        fileName={pendingFile?.name || ''}
        busy={confirmBusy}
        onConfirm={confirmImport}
        onClose={closePreview}
      />
    </div>
  );
}
