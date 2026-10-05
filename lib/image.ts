// Client-side image compression so uploads stay small on slow rural networks and
// stored photos don't exhaust on-device storage.

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read image'));
    img.src = src;
  });
}

export function fileToDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error || new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

/** Re-encode as JPEG with the longest side ≤ maxDim. */
export async function compressImage(
  input: string | Blob,
  { maxDim = 1280, quality = 0.8 }: { maxDim?: number; quality?: number } = {},
): Promise<string> {
  const src = typeof input === 'string' ? input : await fileToDataUrl(input);
  const img = await loadImage(src);
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return src;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Small copy for storing in history (~20–40 KB). */
export const makeThumbnail = (dataUrl: string) => compressImage(dataUrl, { maxDim: 480, quality: 0.6 });
