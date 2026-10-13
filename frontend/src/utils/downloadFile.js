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
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Delay revoke so Android/WebKit can start the download first.
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

function ensureBlob(data, mimeType) {
  if (data instanceof Blob) {
    if (mimeType && (!data.type || data.type === 'application/octet-stream')) {
      return new Blob([data], { type: mimeType });
    }
    return data;
  }
  return new Blob([data], { type: mimeType || 'application/octet-stream' });
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

async function readBlobText(blob) {
  if (!blob) return '';
  if (typeof blob.text === 'function') return blob.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsText(blob);
  });
}

async function parseBlobError(blob) {
  try {
    const text = await readBlobText(blob);
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
 * Android DownloadManager (needs MainActivity DownloadListener).
 * Prefer a real <a download> click — hidden iframes often never fire onDownloadStart,
 * so the OS never shows a “download complete” notification.
 * Session cookies are forwarded by the native WebView download handler.
 */
function triggerAndroidSystemDownload(absoluteUrl, filename = '') {
  const a = document.createElement('a');
  a.href = absoluteUrl;
  if (filename) a.setAttribute('download', sanitizeFilename(filename));
  a.rel = 'noopener';
  a.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none';
  document.body.appendChild(a);
  a.click();
  window.setTimeout(() => a.remove(), 2_000);
}

/** Write a file to device Documents — no share sheet, no viewer. */
async function saveBlobToDevice(blob, filename, folder = 'Luminexa/exports') {
  if (!Capacitor.isPluginAvailable('Filesystem')) return false;

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem');
    const safeName = sanitizeFilename(filename);
    const base64 = await blobToBase64(blob);
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

async function savePdfToDevice(blob, filename) {
  return saveBlobToDevice(blob, filename, 'Luminexa/invoices');
}

/** Turn axios blob error bodies into a readable message. */
export async function parseDownloadError(err, fallback = 'Download failed') {
  const status = err?.response?.status;
  const data = err?.response?.data;
  if (data instanceof Blob) {
    const fromBlob = await parseBlobError(data);
    if (fromBlob && fromBlob !== 'Download failed') return fromBlob;
  } else if (typeof data?.detail === 'string') {
    return data.detail;
  }
  if (status === 401) return 'Sign in again to download.';
  if (status === 403) return 'You do not have permission to download this export.';
  if (err?.message) return err.message;
  return fallback;
}

/**
 * Save/download an in-memory Blob (CSV, ZIP, Excel, JSON).
 * Avoids bare blob+a.click in Capacitor WebViews (those crash the app).
 */
export async function downloadBlob({ blob, filename, mimeType } = {}) {
  if (!blob) throw new Error('Nothing to download.');
  const safeName = sanitizeFilename(filename);
  const file = ensureBlob(blob, mimeType);

  if (!isNativeApp()) {
    downloadBlobInBrowser(file, safeName);
    return { method: 'browser' };
  }

  if (await saveBlobToDevice(file, safeName, 'Luminexa/exports')) {
    return { method: 'saved' };
  }

  // Last resort — still append to body (safer than floating <a>).
  try {
    downloadBlobInBrowser(file, safeName);
    return { method: 'browser-fallback' };
  } catch {
    throw new Error('Could not save the file. Update Luminexa, then try again.');
  }
}

/**
 * Analytics / business exports.
 * Same strategy as invoices: authenticated fetch + save to device first.
 * Android DownloadManager (with OS notification) is only a fallback — a bare
 * iframe “download started” toast was lying when the system never received the file.
 * @param {{ url: string, filename: string, fetchBlob?: () => Promise<Blob> }} opts
 */
export async function downloadExportFile({ url, filename, fetchBlob } = {}) {
  const safeName = sanitizeFilename(filename);
  const absoluteUrl = resolveAbsoluteUrl(url);

  if (typeof fetchBlob !== 'function') {
    throw new Error('Download is not available.');
  }

  const blob = await fetchBlob();

  if (!isNativeApp()) {
    downloadBlobInBrowser(blob, safeName);
    return { method: 'browser' };
  }

  if (await saveBlobToDevice(blob, safeName, 'Luminexa/exports')) {
    return { method: 'saved' };
  }

  if (Capacitor.getPlatform() === 'android' && absoluteUrl) {
    triggerAndroidSystemDownload(absoluteUrl, safeName);
    return { method: 'android-download' };
  }

  try {
    downloadBlobInBrowser(blob, safeName);
    return { method: 'browser-fallback' };
  } catch {
    throw new Error('Could not save the file. Update Luminexa, then try again.');
  }
}

export function exportDownloadSuccessMessage(method) {
  if (method === 'saved') {
    return 'Saved on this phone — Files → Documents → Luminexa → exports.';
  }
  if (method === 'android-download') {
    return 'Downloading… check your notification shade when it finishes.';
  }
  return 'Download started.';
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
    triggerAndroidSystemDownload(absoluteUrl, safeName);
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
