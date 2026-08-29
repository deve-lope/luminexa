import { costLinesToBillItems } from './jobBillItems';

describe('costLinesToBillItems', () => {
  test('maps a drafted extra onto the customer bill as a line total', () => {
    expect(
      costLinesToBillItems([
        {
          kind: 'expense',
          description: 'Oil filter',
          quantity: '1.00',
          unit_cost: '18.50',
          total_cost: '18.50',
        },
      ])
    ).toEqual([
      {
        name: 'Oil filter',
        type: 'extra',
        brand: '',
        quantity: 1,
        amount: '18.50',
      },
    ]);
  });

  test('keeps quantity and uses the line total for two of the same part', () => {
    const [item] = costLinesToBillItems([
      {
        kind: 'material',
        description: 'Cabin filter',
        quantity: '2',
        unit_cost: '12',
        total_cost: '24.00',
      },
    ]);
    expect(item).toMatchObject({
      name: 'Cabin filter',
      type: 'material',
      quantity: 2,
      amount: '24.00',
    });
  });
});
