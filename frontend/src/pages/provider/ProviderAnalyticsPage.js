import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Skeleton from '../../components/Skeleton';
import { useProviderOrg } from '../../contexts/ProviderOrgContext';
import { jobsAPI } from '../../utils/api';
import { parseApiError } from '../../utils/taskDisplay';

const PERIODS = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'year', label: 'Year' },
  { id: 'all', label: 'All time' },
];

function formatMoney(amount, currency = 'CAD') {
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${currency} ${n.toFixed(2)}`;
  }
}

function formatHours(h) {
  if (h == null) return '—';
  const n = Number(h);
  if (n === 0) return '0h';
  if (n < 10) return `${n.toFixed(1)}h`;
  return `${Math.round(n)}h`;
}

function Delta({ value }) {
  if (value == null) return null;
  const up = value > 0;
  const flat = value === 0;
  return (
    <span
      className={`text-[11px] font-semibold ${
        flat ? 'text-slate-400' : up ? 'text-emerald-600' : 'text-rose-600'
      }`}
    >
      {flat ? '±0%' : `${up ? '+' : ''}${value}%`}
      <span className="ml-1 font-normal text-slate-400">vs prior</span>
    </span>
  );
}

function StatCard({ label, value, hint, delta }) {
  return (
    <div className="rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      {delta != null ? (
        <p className="mt-1">
          <Delta value={delta} />
        </p>
      ) : null}
    </div>
  );
}

function SimpleBars({ series, valueKey, formatValue, emptyLabel }) {
  const max = useMemo(() => {
    let m = 0;
    for (const row of series || []) {
      const v = Number(row[valueKey]) || 0;
      if (v > m) m = v;
    }
    return m || 1;
  }, [series, valueKey]);

  if (!series?.length) {
    return <p className="py-6 text-center text-sm text-slate-500">{emptyLabel}</p>;
  }

  const showEvery = series.length > 14 ? Math.ceil(series.length / 7) : 1;

  return (
    <div className="mt-3">
      <div className="flex h-36 items-end gap-1 sm:gap-1.5">
        {series.map((row, i) => {
          const v = Number(row[valueKey]) || 0;
          const h = Math.max(v > 0 ? 8 : 2, Math.round((v / max) * 100));
          return (
            <div key={row.label} className="flex min-w-0 flex-1 flex-col items-center justify-end">
              <div
                className="w-full max-w-[28px] rounded-t-md bg-gradient-to-t from-teal-700 to-teal-400"
                style={{ height: `${h}%` }}
                title={`${row.label}: ${formatValue(row[valueKey])}`}
              />
              {(i % showEvery === 0 || i === series.length - 1) && (
                <span className="mt-1 max-w-full truncate text-[9px] text-slate-400">
                  {row.label.slice(-5)}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function ProviderAnalyticsPage() {
  const { orgSlug } = useProviderOrg();
  const [period, setPeriod] = useState('month');
  const [data, setData] = useState(null);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState(null);
  const [chartMode, setChartMode] = useState('income');
  const [exportBusy, setExportBusy] = useState(false);
  const [dataExportBusy, setDataExportBusy] = useState(false);

  const load = useCallback(async () => {
    if (!orgSlug) return;
    setFetching(true);
    setError(null);
    try {
      const res = await jobsAPI.getProviderAnalytics(orgSlug, period);
      setData(res.data);
    } catch (e) {
      setError(parseApiError(e));
      setData(null);
    } finally {
      setFetching(false);
    }
  }, [orgSlug, period]);

  const downloadBooks = async () => {
    setExportBusy(true);
    setError(null);
    try {
      const res = await jobsAPI.downloadProviderBooksExport(orgSlug, period);
      const blob = new Blob([res.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `luminexa-books-${orgSlug}-${period}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      setError(parseApiError(e) || 'Could not download export.');
    } finally {
      setExportBusy(false);
    }
  };

  const downloadDataExport = async (format) => {
    setDataExportBusy(true);
    setError(null);
    try {
      const res = await jobsAPI.downloadOrganizationDataExport(orgSlug, format);
      const contentType = format === 'json' 
        ? 'application/json' 
        : format === 'csv' 
        ? 'application/zip' 
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const blob = new Blob([res.data], { type: contentType });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = format === 'csv' ? 'zip' : format === 'excel' ? 'xlsx' : 'json';
      a.download = `${orgSlug}-export-${new Date().toISOString().split('T')[0]}.${ext}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      const errMsg = parseApiError(e);
      if (errMsg?.includes('Pro subscription')) {
        setError('Pro subscription required to export business data.');
      } else if (errMsg?.includes('owner')) {
        setError('Only the organization owner can export business data.');
      } else {
        setError(errMsg || 'Could not download export.');
      }
    } finally {
      setDataExportBusy(false);
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const currency = data?.currency || 'CAD';
  const summary = data?.summary || {};
  const totals = data?.totals || {};
  const compare = data?.compare || {};

  if (!orgSlug || (fetching && !data)) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading analytics">
        <Skeleton className="h-12 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
          <Skeleton className="h-24 rounded-2xl" />
        </div>
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="lx-empty">
        <p className="text-slate-600">{error || 'Could not load analytics.'}</p>
        <button type="button" onClick={load} className="lx-btn-primary mt-4">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 pb-8">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-600">
          Cash, profit, and receivables for your business. Add costs on each job for accurate
          margins.
        </p>
        <button
          type="button"
          disabled={exportBusy}
          onClick={downloadBooks}
          className="min-h-[40px] shrink-0 rounded-xl bg-white px-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 disabled:opacity-60"
        >
          {exportBusy ? 'Exporting…' : 'Export CSV'}
        </button>
      </div>

      <section className="rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft">
        <h2 className="text-sm font-semibold text-slate-900">Export All Business Data</h2>
        <p className="mt-1 text-xs text-slate-500">
          Download your complete business data for migration or backup. Includes bookings, customers,
          invoices, messages, services, schedule, and more.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={dataExportBusy}
            onClick={() => downloadDataExport('json')}
            className="min-h-[40px] rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:opacity-60"
          >
            {dataExportBusy ? 'Exporting…' : 'Download JSON'}
          </button>
          <button
            type="button"
            disabled={dataExportBusy}
            onClick={() => downloadDataExport('csv')}
            className="min-h-[40px] rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
          >
            {dataExportBusy ? 'Exporting…' : 'Download CSV (ZIP)'}
          </button>
          <button
            type="button"
            disabled={dataExportBusy}
            onClick={() => downloadDataExport('excel')}
            className="min-h-[40px] rounded-xl bg-white px-4 text-sm font-semibold text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
          >
            {dataExportBusy ? 'Exporting…' : 'Download Excel'}
          </button>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          <span className="font-semibold">Pro subscription required.</span> Export is owner-only.
        </p>
      </section>

      <div
        className="flex gap-1 overflow-x-auto rounded-2xl border border-luminexa-line bg-white p-1 shadow-lx-soft"
        role="tablist"
        aria-label="Time period"
      >
        {PERIODS.map((p) => {
          const active = period === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setPeriod(p.id)}
              className={`min-h-[40px] flex-1 rounded-xl px-3 text-sm font-semibold transition ${
                active
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'
              }`}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <section className="grid grid-cols-2 gap-3">
        <StatCard
          label="Gigs done"
          value={summary.gigs_completed ?? 0}
          hint={`All time: ${totals.gigs_completed ?? 0}`}
          delta={compare.gigs_completed}
        />
        <StatCard
          label="Income collected"
          value={formatMoney(summary.income_collected, currency)}
          hint={
            Number(summary.income_outstanding) > 0
              ? `${formatMoney(summary.income_outstanding, currency)} outstanding`
              : `All time: ${formatMoney(totals.income_collected, currency)}`
          }
          delta={compare.income_collected}
        />
        <StatCard
          label="Job profit"
          value={formatMoney(summary.profit, currency)}
          hint={`Costs ${formatMoney(summary.job_costs, currency)} · fees ${formatMoney(summary.platform_fees, currency)}`}
          delta={compare.profit}
        />
        <StatCard
          label="Hours spent"
          value={formatHours(summary.hours_spent)}
          hint={`All time: ${formatHours(totals.hours_spent)}`}
          delta={compare.hours_spent}
        />
        <StatCard
          label="Customers"
          value={summary.unique_customers ?? 0}
          hint={`${summary.recurring_customers ?? 0} recurring (${summary.recurring_rate ?? 0}%)`}
          delta={compare.unique_customers}
        />
        <StatCard
          label="Open quotes"
          value={formatMoney(summary.quoted_pipeline, currency)}
          hint="Quoted, not yet accepted"
        />
      </section>

      {data.ar_aging && (
        <section className="rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft">
          <h2 className="lx-section-title">Accounts receivable</h2>
          <p className="mt-1 text-xs text-slate-500">
            Unpaid invoices by age ({data.ar_aging.count} open)
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Current', data.ar_aging.current],
              ['1–30 days', data.ar_aging.days_1_30],
              ['31–60 days', data.ar_aging.days_31_60],
              ['60+ days', data.ar_aging.days_60_plus],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl bg-slate-50 p-3">
                <p className="text-[10px] font-semibold uppercase text-slate-400">{label}</p>
                <p className="mt-0.5 text-sm font-bold text-slate-900">
                  {formatMoney(value, currency)}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Avg job value"
          value={
            summary.avg_job_value != null
              ? formatMoney(summary.avg_job_value, currency)
              : '—'
          }
        />
        <StatCard
          label="Conversion"
          value={`${summary.conversion_rate ?? 0}%`}
          hint={`${summary.completed ?? 0} of ${summary.requests_received ?? 0} booked`}
        />
        <StatCard
          label="Avg rating"
          value={summary.avg_rating != null ? summary.avg_rating.toFixed(1) : '—'}
          hint={`${summary.review_count ?? 0} review${summary.review_count === 1 ? '' : 's'}`}
        />
        <StatCard
          label="Needs return"
          value={summary.needs_return_open ?? 0}
          hint="Open now"
        />
      </section>

      <section className="rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft">
        <div className="flex items-center justify-between gap-2">
          <h2 className="lx-section-title">Trend</h2>
          <div className="flex rounded-lg bg-slate-100 p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setChartMode('income')}
              className={`rounded-md px-2.5 py-1 ${
                chartMode === 'income' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Income
            </button>
            <button
              type="button"
              onClick={() => setChartMode('gigs')}
              className={`rounded-md px-2.5 py-1 ${
                chartMode === 'gigs' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Gigs
            </button>
          </div>
        </div>
        <SimpleBars
          series={data.series}
          valueKey={chartMode === 'income' ? 'income' : 'gigs'}
          formatValue={(v) =>
            chartMode === 'income' ? formatMoney(v, currency) : String(v ?? 0)
          }
          emptyLabel="No activity in this period yet."
        />
      </section>

      <section className="rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft">
        <h2 className="lx-section-title">By service</h2>
        {!data.by_service?.length ? (
          <p className="mt-3 text-sm text-slate-500">No completed gigs in this period.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.by_service.map((row) => (
              <li key={row.service_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.service_name}</p>
                  <p className="text-xs text-slate-500">
                    {row.gigs} gig{row.gigs === 1 ? '' : 's'} · {formatHours(row.hours)}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-800">
                  {formatMoney(row.income, currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft">
        <h2 className="lx-section-title">Top customers</h2>
        {!data.top_customers?.length ? (
          <p className="mt-3 text-sm text-slate-500">No customers in this period yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-slate-100">
            {data.top_customers.map((row) => (
              <li key={row.customer_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{row.full_name}</p>
                  <p className="text-xs text-slate-500">
                    {row.gigs} gig{row.gigs === 1 ? '' : 's'}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-800">
                  {formatMoney(row.income, currency)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {fetching && (
        <p className="text-center text-xs text-slate-400" aria-live="polite">
          Updating…
        </p>
      )}
    </div>
  );
}
