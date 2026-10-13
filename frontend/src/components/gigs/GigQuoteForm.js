import React, { useEffect, useMemo, useState } from 'react';
import ConfirmDialog from '../ConfirmDialog';
import {
  CONTACT_HINT,
  CONTACT_INFO_ERROR,
  textContainsContactInfo,
} from '../../utils/contactInfo';

export default function GigQuoteForm({
  onSubmit,
  initialData = null,
  loading = false,
  onWithdraw = null,
  withdrawBusy = false,
}) {
  const [formData, setFormData] = useState({
    price: initialData?.price || '',
    description: initialData?.description || '',
    estimated_duration_days: initialData?.estimated_duration_days || '',
  });
  const [errors, setErrors] = useState({});
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const contactBlocked = useMemo(
    () => textContainsContactInfo(formData.description),
    [formData.description],
  );

  useEffect(() => {
    if (initialData) {
      setFormData({
        price: initialData.price || '',
        description: initialData.description || '',
        estimated_duration_days: initialData.estimated_duration_days || '',
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const nextErrors = {};
    const price = Number(formData.price);
    if (!price || price < 0.01) nextErrors.price = 'Enter a valid price.';
    const description = (formData.description || '').trim();
    if (!description) nextErrors.description = 'Describe what this bid covers.';
    if (description.length > 1500) nextErrors.description = 'Max 1500 characters.';
    if (textContainsContactInfo(description)) nextErrors.description = CONTACT_INFO_ERROR;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const payload = {
      price: String(price),
      description,
    };
    if (formData.estimated_duration_days) {
      payload.estimated_duration_days = Number(formData.estimated_duration_days);
    }
    await onSubmit?.(payload);
    if (!initialData) {
      setFormData({ price: '', description: '', estimated_duration_days: '' });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="gig-pin-sheet space-y-3 !pt-10">
      <h3 className="font-bold tracking-tight text-slate-900">
        {initialData ? 'Update your bid' : 'Place a bid'}
      </h3>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">Price *</label>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">$</span>
          <input
            type="number"
            name="price"
            step="0.01"
            min="0.01"
            value={formData.price}
            onChange={handleChange}
            className="lx-input text-sm"
            required
          />
        </div>
        {errors.price && <p className="mt-1 text-sm text-red-600">{errors.price}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          What this bid covers *
        </label>
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          maxLength={1500}
          rows={4}
          className="lx-input resize-y text-sm"
          required
        />
        <div className="mt-1 text-xs text-slate-500">{formData.description.length}/1500</div>
        <p className="mt-1 text-xs text-slate-500">{CONTACT_HINT}</p>
        {contactBlocked && (
          <p className="mt-2 rounded-lg bg-amber-50 px-2.5 py-2 text-sm text-amber-900">
            {CONTACT_INFO_ERROR}
          </p>
        )}
        {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description}</p>}
      </div>
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Estimated duration (optional)
        </label>
        <div className="flex items-center gap-2">
          <input
            type="number"
            name="estimated_duration_days"
            min="1"
            value={formData.estimated_duration_days}
            onChange={handleChange}
            className="lx-input w-32 text-sm"
          />
          <span className="text-sm text-slate-500">days</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <button
          type="submit"
          disabled={loading || withdrawBusy || contactBlocked}
          className="lx-btn-primary px-4 py-2 text-sm disabled:opacity-50"
        >
          {loading ? 'Saving…' : initialData ? 'Update bid' : 'Place bid'}
        </button>
        {onWithdraw && (
          <button
            type="button"
            disabled={loading || withdrawBusy}
            onClick={() => setConfirmWithdraw(true)}
            className="rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-700 disabled:opacity-50"
          >
            {withdrawBusy ? 'Withdrawing…' : 'Withdraw bid'}
          </button>
        )}
      </div>

      <ConfirmDialog
        open={confirmWithdraw}
        title="Withdraw this bid?"
        message="You can place a new bid on this gig later."
        confirmLabel="Withdraw bid"
        cancelLabel="Keep bid"
        tone="danger"
        busy={withdrawBusy}
        onClose={() => !withdrawBusy && setConfirmWithdraw(false)}
        onConfirm={() => {
          setConfirmWithdraw(false);
          onWithdraw?.();
        }}
      />
    </form>
  );
}
