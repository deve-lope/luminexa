import { Capacitor } from '@capacitor/core';
import api from './api';
import { isNativeApp } from '../native/capacitorNative';

export function resolveAbsoluteUrl(path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${path.startsWith('/') ? path : `/${path}`}`;
}

function sanitizeFilename(name) {
  const trimmed = String(name || 'download').trim();
  const safe = trimmed.replace(/[^\w.\-]+/g, '_');
  return safe || 'download.pdf';
}

function downloadBlobInBrowser(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result;
      if (typeof dataUrl !== 'string') {
        reject(new Error('Could not read file'));
        return;
      }
      const comma = dataUrl.indexOf(',');
      resolve(comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl);
    };
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(blob);
  });
}

function apiPath(url) {
  if (!url) return url;
  if (/^https?:\/\//i.test(url)) {
    try {
      const parsed = new URL(url);
      return `${parsed.pathname}${parsed.search}`;
    } catch {
      return url;
    }
  }
  return url.startsWith('/') ? url : `/${url}`;
}

async function parseBlobError(blob) {
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);
    return parsed.detail || parsed.message || 'Download failed';
  } catch {
    return 'Download failed';
  }
}

/** Same axios client as the rest of the app (session cookies). */
export async function fetchPdfBlob(url) {
  const path = apiPath(url);
  try {
    const res = await api.get(path, { responseType: 'blob' });
    const blob = res.data;
    if (!(blob instanceof Blob)) {
      throw new Error('Download failed');
    }
    const type = (blob.type || '').toLowerCase();
    if (type.includes('json') || (blob.size < 1024 && type.includes('text'))) {
      throw new Error(await parseBlobError(blob));
    }
    return blob;
  } catch (err) {
    const status = err?.response?.status;
    if (status === 401 || status === 403) {
      throw new Error('Sign in again to download this invoice.');
    }
    if (status === 404) {
      throw new Error('Invoice not found.');
    }
    if (err?.response?.data instanceof Blob) {
      throw new Error(await parseBlobError(err.response.data));
    }
    throw new Error(err?.message || 'Download failed');
  }
}

/**
 * Android DownloadManager (needs MainActivity listener in the Play Store app build).
 * Session cookies are forwarded by the native WebView download handler.
 */
function triggerAndroidSystemDownload(absoluteUrl) {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.style.cssText =
    'position:absolute;width:0;height:0;border:0;opacity:0;pointer-events:none';
  iframe.src = absoluteUrl;
  document.body.appendChild(iframe);
  window.setTimeout(() => iframe.remove(), 120_000);
}

/** Write PDF to device storage — no share sheet, no viewer. */
async function savePdfToDevice(blob, filename) {
  if (!Capacitor.isPluginAvailable('Filesystem')) return false;

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const safeName = sanitizeFilename(filename);
    const base64 = await blobToBase64(blob);
    const folder = 'Luminexa/invoices';
    const path = `${folder}/${safeName}`;

    if (Capacitor.getPlatform() === 'android') {
      const status = await Filesystem.checkPermissions();
      if (status.publicStorage !== 'granted') {
        const req = await Filesystem.requestPermissions();
        if (req.publicStorage !== 'granted') {
          return false;
        }
      }
    }

    try {
      await Filesystem.mkdir({ path: folder, directory: Directory.Documents, recursive: true });
    } catch {
      // Folder may already exist.
    }

    await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Documents,
    });
    return true;
  } catch {
    return false;
  }
}

/**
 * Download invoice PDF.
 * - Laptop / browser: normal file download
 * - Android app: save to device or system Downloads (no extra screens)
 */
export async function downloadFromUrl({ url, filename = 'download.pdf' }) {
  const safeName = sanitizeFilename(filename);
  const absoluteUrl = resolveAbsoluteUrl(url);
  const platform = Capacitor.getPlatform();

  if (!isNativeApp()) {
    const blob = await fetchPdfBlob(url);
    downloadBlobInBrowser(blob, safeName);
    return { method: 'browser' };
  }

  if (platform === 'android') {
    if (Capacitor.isPluginAvailable('Filesystem')) {
      const blob = await fetchPdfBlob(url);
      if (await savePdfToDevice(blob, safeName)) {
        return { method: 'saved' };
      }
    }
    triggerAndroidSystemDownload(absoluteUrl);
    return { method: 'android-download' };
  }

  // iOS — fetch then save to app Documents
  const blob = await fetchPdfBlob(url);
  if (await savePdfToDevice(blob, safeName)) {
    return { method: 'saved' };
  }

  throw new Error(
    'Could not save the invoice. Update Luminexa from the App Store, then try again.',
  );
}

export async function downloadInvoicePdf({ url, filename, number, bookingId, downloadUrlBuilder }) {
  const path =
    url ||
    downloadUrlBuilder?.() ||
    (bookingId ? `/api/v1/bookings/${bookingId}/invoice/download/` : null);
  if (!path) throw new Error('Missing invoice download URL');
  const name = filename || (number ? `${number}.pdf` : 'invoice.pdf');
  return downloadFromUrl({ url: path, filename: name });
}

export function downloadSuccessMessage() {
  return 'Invoice downloaded.';
}
