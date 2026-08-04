import React, { useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

const KINDS = [
  { id: 'material', label: 'Material' },
  { id: 'labor', label: 'Labor' },
  { id: 'expense', label: 'Expense' },
];

function money(amount, currency = 'CAD') {
  const n = Number(amount);
  if (Number.isNaN(n)) return '—';
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(n);
  } catch {
    return `${n.toFixed(2)}`;
  }
}

/**
 * Internal job costs + profit (staff only). Not shown on the customer invoice.
 */
export default function JobCostPanel({
  bookingId,
  currency = 'CAD',
  initialLines = [],
  initialProfit = null,
  defaultLaborRate = null,
  onChanged,
}) {
  const [lines, setLines] = useState(initialLines || []);
  const [profit, setProfit] = useState(initialProfit);
  const [kind, setKind] = useState('expense');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState(
    defaultLaborRate != null ? String(defaultLaborRate) : ''
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const refreshFrom = (payload) => {
    if (payload?.cost_lines) {
      setLines(payload.cost_lines);
    } else if (payload?.cost_line) {
      setLines((prev) => [...prev.filter((l) => l.id !== payload.cost_line.id), payload.cost_line]);
    }
    if (payload?.profit) setProfit(payload.profit);
    onChanged?.(payload);
  };

  const addLine = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const res = await jobsAPI.addBookingCost(bookingId, {
        kind,
        description,
        quantity,
        unit_cost: unitCost || '0',
      });
      refreshFrom(res.data);
      setDescription('');
      setQuantity('1');
      if (kind !== 'labor') setUnitCost('');
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeLine = async (costId) => {
    setBusy(true);
    setError('');
    try {
      const res = await jobsAPI.deleteBookingCost(bookingId, costId);
      setLines((prev) => prev.filter((l) => l.id !== costId));
      if (res.data?.profit) setProfit(res.data.profit);
      onChanged?.(res.data);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl border border-luminexa-line bg-white p-4 shadow-lx-soft space-y-3">
      <div>
        <h2 className="text-sm font-semibold uppercase text-slate-500">Job costs</h2>
        <p className="mt-1 text-xs text-slate-500">
          Materials, labor, and expenses for your books — not shown on the customer invoice.
        </p>
      </div>

      {profit && (
        <div className="grid grid-cols-3 gap-2 rounded-xl bg-slate-50 p-3 text-center text-sm">
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-400">Revenue</p>
            <p className="font-semibold text-slate-900">{money(profit.revenue, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-400">Costs</p>
            <p className="font-semibold text-slate-900">{money(profit.costs, currency)}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase text-slate-400">Profit</p>
            <p
              className={`font-semibold ${
                Number(profit.profit) >= 0 ? 'text-emerald-700' : 'text-rose-700'
              }`}
            >
              {money(profit.profit, currency)}
              {profit.margin_percent != null ? (
                <span className="ml-1 text-xs font-normal text-slate-500">
                  ({profit.margin_percent}%)
                </span>
              ) : null}
            </p>
          </div>
        </div>
      )}

      {lines.length > 0 && (
        <ul className="divide-y divide-slate-100 text-sm">
          {lines.map((line) => (
            <li key={line.id} className="flex items-start justify-between gap-2 py-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">{line.description}</p>
                <p className="text-xs text-slate-500">
                  {line.kind} · {line.quantity} × {money(line.unit_cost, currency)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="font-semibold text-slate-800">
                  {money(line.total_cost, currency)}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => removeLine(line.id)}
                  className="text-xs font-semibold text-rose-600 disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={addLine} className="space-y-2 border-t border-slate-100 pt-3">
        <div className="flex flex-wrap gap-1">
          {KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                setKind(k.id);
                if (k.id === 'labor' && defaultLaborRate != null) {
                  setUnitCost(String(defaultLaborRate));
                }
              }}
              className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                kind === k.id
                  ? 'bg-teal-700 text-white'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {k.label}
            </button>
          ))}
        </div>
        <input
          required
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description"
          className="lx-input w-full"
        />
        <div className="grid grid-cols-2 gap-2">
          <input
            required
            type="number"
            min="0.01"
            step="0.01"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder={kind === 'labor' ? 'Hours' : 'Qty'}
            className="lx-input"
          />
          <input
            required
            type="number"
            min="0"
            step="0.01"
            value={unitCost}
            onChange={(e) => setUnitCost(e.target.value)}
            placeholder={kind === 'labor' ? 'Rate / hr' : 'Unit cost'}
            className="lx-input"
          />
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="min-h-[44px] w-full rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white disabled:opacity-60"
        >
          {busy ? 'Saving…' : 'Add cost'}
        </button>
      </form>
    </section>
  );
}
