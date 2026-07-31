import { computeExportDrawRect, validateImageSourceFile } from './cropImage';

describe('cropImage helpers', () => {
  test('validateImageSourceFile rejects missing and oversized files', () => {
    expect(validateImageSourceFile(null)).toMatch(/choose/i);
    expect(
      validateImageSourceFile({ type: 'image/png', size: 20 * 1024 * 1024 }, { maxBytes: 8 * 1024 * 1024 }),
    ).toMatch(/8 MB/i);
    expect(validateImageSourceFile({ type: 'application/pdf', size: 1000 })).toMatch(/jpeg/i);
    expect(validateImageSourceFile({ type: 'image/jpeg', size: 1000 })).toBeNull();
  });

  test('computeExportDrawRect scales a 3:1 crop into 1500x500', () => {
    const rect = computeExportDrawRect({ x: 10, y: 20, width: 900, height: 300 }, 1500, 500);
    expect(rect.sWidth).toBe(900);
    expect(rect.sHeight).toBe(300);
    expect(rect.dWidth).toBe(1500);
    expect(rect.dHeight).toBe(500);
    expect(rect.dx).toBe(0);
    expect(rect.dy).toBe(0);
  });

  test('computeExportDrawRect centers a square crop into 512x512', () => {
    const rect = computeExportDrawRect({ x: 0, y: 0, width: 256, height: 256 }, 512, 512);
    expect(rect.dWidth).toBe(512);
    expect(rect.dHeight).toBe(512);
    expect(rect.dx).toBe(0);
    expect(rect.dy).toBe(0);
  });
});
