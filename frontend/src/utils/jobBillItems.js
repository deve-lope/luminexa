/**
 * Convert job extras (cost lines) into invoice bill items.
 * Invoice `amount` is the line total, not the unit price.
 */
export function costLinesToBillItems(lines) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => {
      const qty = Number(line?.quantity);
      const quantity = Number.isFinite(qty) && qty > 0 ? qty : 1;
      const total = Number(line?.total_cost);
      const unit = Number(line?.unit_cost);
      const amount = Number.isFinite(total)
        ? total
        : Number.isFinite(unit)
          ? unit * quantity
          : 0;
      const kind = String(line?.kind || '').toLowerCase();
      return {
        name: String(line?.description || '').trim(),
        type: kind === 'expense' ? 'extra' : kind,
        brand: '',
        quantity: Number.isInteger(quantity) ? quantity : Math.round(quantity * 100) / 100,
        amount: amount.toFixed(2),
      };
    })
    .filter((item) => item.name);
}
