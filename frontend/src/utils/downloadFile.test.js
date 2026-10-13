import api from './api';
import {
  downloadBlob,
  fetchPdfBlob,
  parseDownloadError,
  resolveAbsoluteUrl,
} from './downloadFile';

jest.mock('./api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
}));

jest.mock('../native/capacitorNative', () => ({
  isNativeApp: () => false,
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

  test('parseDownloadError reads blob JSON detail', async () => {
    const msg = await parseDownloadError({
      response: {
        status: 403,
        data: new Blob([JSON.stringify({ detail: 'Pro subscription required.' })], {
          type: 'application/json',
        }),
      },
    });
    expect(msg).toBe('Pro subscription required.');
  });

  test('downloadBlob triggers a browser download without crashing', async () => {
    const click = jest.fn();
    const remove = jest.fn();
    const appendChild = jest.spyOn(document.body, 'appendChild').mockImplementation((el) => {
      el.click = click;
      el.remove = remove;
      return el;
    });
    const createObjectURL = jest.fn(() => 'blob:test');
    const revokeObjectURL = jest.fn();
    window.URL.createObjectURL = createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL;

    const result = await downloadBlob({
      blob: new Blob(['a,b\n'], { type: 'text/csv' }),
      filename: 'books.csv',
    });
    expect(result.method).toBe('browser');
    expect(createObjectURL).toHaveBeenCalled();
    expect(click).toHaveBeenCalled();
    expect(remove).toHaveBeenCalled();
    appendChild.mockRestore();
  });

  test('export success copy explains saved path vs system download', () => {
    const { exportDownloadSuccessMessage } = require('./downloadFile');
    expect(exportDownloadSuccessMessage('saved')).toMatch(/Documents/);
    expect(exportDownloadSuccessMessage('android-download')).toMatch(/notification/i);
  });
});
