import React, { useMemo, useState } from 'react';
import { jobsAPI } from '../../utils/api';
import parseApiError from '../../utils/parseApiError';

const KINDS = [
  { id: 'material', label: 'Part', hint: 'A part or product you picked up for this job.' },
  { id: 'expense', label: 'Extra', hint: 'A pass-through like parking, disposal, or a shop fee.' },
  { id: 'labor', label: 'Labor', hint: 'Extra time to add on top of the service fee.' },
];

const KIND_BADGE = {
  material: 'bg-sky-50 text-sky-800',
  expense: 'bg-slate-100 text-slate-700',
  labor: 'bg-amber-50 text-amber-900',
};

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

function lineTotal(line) {
  const total = Number(line?.total_cost);
  if (Number.isFinite(total)) return total;
  return (Number(line?.quantity) || 0) * (Number(line?.unit_cost) || 0);
}

function kindLabel(id) {
  return KINDS.find((k) => k.id === id)?.label || id;
}

/**
 * Draft extras for the customer bill. Added here so the provider can log parts
 * bought before the job day; they copy onto the invoice at complete.
 */
export default function JobCostPanel({
  bookingId,
  currency = 'CAD',
  initialLines = [],
  onChanged,
}) {
  const [lines, setLines] = useState(initialLines || []);
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState('material');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState(null);
  const [error, setError] = useState('');

  const billTotal = useMemo(
    () => lines.reduce((sum, line) => sum + lineTotal(line), 0),
    [lines]
  );
  const qtyNum = Number(quantity);
  const amountNum = Number(amount);
  const unitCost =
    Number.isFinite(qtyNum) && qtyNum > 0 && Number.isFinite(amountNum)
      ? amountNum / qtyNum
      : null;
  const meta = KINDS.find((k) => k.id === kind) || KINDS[0];

  const refreshFrom = (payload) => {
    if (payload?.cost_lines) {
      setLines(payload.cost_lines);
    } else if (payload?.cost_line) {
      setLines((prev) => [...prev.filter((l) => l.id !== payload.cost_line.id), payload.cost_line]);
    }
    onChanged?.(payload);
  };

  const resetForm = () => {
    setDescription('');
    setQuantity('1');
    setAmount('');
    setError('');
  };

  const addLine = async (e) => {
    e.preventDefault();
    if (unitCost == null || unitCost < 0) {
      setError('Enter a valid amount to bill.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const res = await jobsAPI.addBookingCost(bookingId, {
        kind,
        description,
        quantity: quantity || '1',
        unit_cost: unitCost.toFixed(2),
      });
      refreshFrom(res.data);
      resetForm();
      setAdding(false);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setBusy(false);
    }
  };

  const removeLine = async (costId) => {
    setRemovingId(costId);
    setError('');
    try {
      const res = await jobsAPI.deleteBookingCost(bookingId, costId);
      if (res.data?.cost_lines) {
        setLines(res.data.cost_lines);
      } else {
        setLines((prev) => prev.filter((l) => l.id !== costId));
      }
      onChanged?.(res.data);
    } catch (err) {
      setError(parseApiError(err));
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <section className="lx-card space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold uppercase text-slate-500">Parts & extras</h2>
          <p className="mt-1 text-sm text-slate-500">
            Add something you bought for this job. It goes on the customer&apos;s bill when you
            complete the work.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setError('');
            }}
            className="lx-btn-secondary shrink-0 px-4 text-sm"
          >
            Add to bill
          </button>
        )}
      </div>

      {lines.length === 0 && !adding && (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 px-3 py-4 text-center text-sm text-slate-500">
          Nothing extra on the bill yet.
        </p>
      )}

      {lines.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      KIND_BADGE[line.kind] || KIND_BADGE.expense
                    }`}
                  >
                    {kindLabel(line.kind)}
                  </span>
                  <p className="truncate font-medium text-slate-900">{line.description}</p>
                </div>
                {Number(line.quantity) !== 1 && (
                  <p className="mt-0.5 text-xs text-slate-500">
                    {line.quantity} × {money(line.unit_cost, currency)}
                  </p>
                )}
              </div>
              <p className="shrink-0 text-sm font-semibold text-slate-900">
                {money(lineTotal(line), currency)}
              </p>
              <button
                type="button"
                disabled={removingId != null}
                onClick={() => removeLine(line.id)}
                aria-label={`Remove ${line.description} from the bill`}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
              >
                {removingId === line.id ? (
                  <span className="text-xs font-semibold text-slate-500">…</span>
                ) : (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.8">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {lines.length > 0 && (
        <p className="flex justify-between text-sm font-medium text-slate-800">
          <span>Extras on the bill</span>
          <span>{money(billTotal, currency)}</span>
        </p>
      )}

      {adding && (
        <form onSubmit={addLine} className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3">
          <div className="grid grid-cols-3 gap-1 rounded-xl bg-white p-1 ring-1 ring-slate-200">
            {KINDS.map((k) => (
              <button
                key={k.id}
                type="button"
                onClick={() => setKind(k.id)}
                className={`min-h-[40px] rounded-lg text-sm font-semibold transition ${
                  kind === k.id ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500">{meta.hint}</p>
          <label className="block text-xs font-medium text-slate-600">
            What to bill
            <input
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. oil filter"
              className="lx-input mt-1"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="block text-xs font-medium text-slate-600">
              Units
              <input
                required
                type="number"
                min="0.01"
                step="0.01"
                inputMode="decimal"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="lx-input mt-1"
              />
            </label>
            <label className="block text-xs font-medium text-slate-600">
              Amount on bill
              <input
                required
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="lx-input mt-1"
              />
            </label>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy} className="lx-btn-primary min-h-[44px] flex-1">
              {busy ? 'Saving…' : 'Add to bill'}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setAdding(false);
                resetForm();
              }}
              className="lx-btn-ghost min-h-[44px] px-4"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && !adding && <p className="text-sm text-red-600">{error}</p>}
    </section>
  );
}
