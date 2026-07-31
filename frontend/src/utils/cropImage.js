/** Canvas helpers for react-easy-crop exports. */

export const COVER_CROP = {
  aspect: 3 / 1,
  exportWidth: 1500,
  exportHeight: 500,
  mimeType: 'image/webp',
  quality: 0.9,
  maxSourceBytes: 8 * 1024 * 1024,
};

export const LOGO_CROP = {
  aspect: 1,
  exportWidth: 512,
  exportHeight: 512,
  mimeType: 'image/webp',
  quality: 0.9,
  maxSourceBytes: 8 * 1024 * 1024,
};

const ALLOWED_SOURCE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

export function validateImageSourceFile(file, { maxBytes = COVER_CROP.maxSourceBytes } = {}) {
  if (!file) {
    return 'Choose an image file.';
  }
  if (file.type && !ALLOWED_SOURCE_TYPES.has(file.type)) {
    return 'Use a JPEG, PNG, WebP, or GIF image.';
  }
  if (typeof file.size === 'number' && file.size > maxBytes) {
    const mb = maxBytes / (1024 * 1024);
    return `Image must be ${mb} MB or smaller.`;
  }
  return null;
}

export function createImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.setAttribute('crossOrigin', 'anonymous');
    image.src = url;
  });
}

/**
 * Map react-easy-crop pixel area onto a fixed export canvas size.
 * Returns { sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight }.
 */
export function computeExportDrawRect(pixelCrop, exportWidth, exportHeight) {
  const sourceW = Math.max(1, Math.round(pixelCrop.width));
  const sourceH = Math.max(1, Math.round(pixelCrop.height));
  const scale = Math.min(exportWidth / sourceW, exportHeight / sourceH);
  const dWidth = Math.round(sourceW * scale);
  const dHeight = Math.round(sourceH * scale);
  return {
    sx: Math.max(0, Math.round(pixelCrop.x)),
    sy: Math.max(0, Math.round(pixelCrop.y)),
    sWidth: sourceW,
    sHeight: sourceH,
    dx: Math.floor((exportWidth - dWidth) / 2),
    dy: Math.floor((exportHeight - dHeight) / 2),
    dWidth,
    dHeight,
  };
}

export async function getCroppedImageBlob(imageSrc, pixelCrop, options = {}) {
  const {
    exportWidth,
    exportHeight,
    mimeType = 'image/webp',
    quality = 0.9,
  } = options;
  const image = await createImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = exportWidth;
  canvas.height = exportHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Could not prepare image canvas.');
  }

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, exportWidth, exportHeight);

  const draw = computeExportDrawRect(pixelCrop, exportWidth, exportHeight);
  ctx.drawImage(
    image,
    draw.sx,
    draw.sy,
    draw.sWidth,
    draw.sHeight,
    draw.dx,
    draw.dy,
    draw.dWidth,
    draw.dHeight,
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Could not export cropped image.'));
          return;
        }
        resolve(blob);
      },
      mimeType,
      quality,
    );
  });
}

export function blobToFile(blob, filename) {
  return new File([blob], filename, {
    type: blob.type || 'image/webp',
    lastModified: Date.now(),
  });
}
