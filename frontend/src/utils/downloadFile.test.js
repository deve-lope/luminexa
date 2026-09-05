import api from './api';
import { fetchPdfBlob, resolveAbsoluteUrl } from './downloadFile';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

describe('downloadFile', () => {
  beforeEach(() => {
    api.get.mockReset();
  });

  test('resolveAbsoluteUrl keeps absolute URLs', () => {
    expect(resolveAbsoluteUrl('https://app.luminex-a.com/api/x')).toBe(
      'https://app.luminex-a.com/api/x',
    );
  });

  test('resolveAbsoluteUrl prefixes relative API paths', () => {
    expect(resolveAbsoluteUrl('/api/v1/bookings/1/invoice/download/')).toBe(
      'http://localhost/api/v1/bookings/1/invoice/download/',
    );
  });

  test('fetchPdfBlob surfaces API error detail', async () => {
    api.get.mockRejectedValue({
      response: {
        status: 404,
        data: new Blob([JSON.stringify({ detail: 'No invoice yet.' })], {
          type: 'application/json',
        }),
      },
    });

    await expect(fetchPdfBlob('/api/v1/bookings/1/invoice/download/')).rejects.toThrow(
      'Invoice not found.',
    );
  });
});
