// Profile photos are stored in the profile itself as a small JPEG data URL.
// The user picks a file, frames it in the cropper (move + zoom), and only the
// framed square is kept, scaled to 320 px: a phone photo of several MB ends
// up around 20–40 KB.

export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
export const PHOTO_ACCEPT = PHOTO_TYPES.join(',');
const MAX_BYTES = 10 * 1024 * 1024; // what we're willing to read
const MIN_SIDE = 64;
export const PHOTO_SIZE = 320; // stored width and height in px

/** Only our own data URLs are ever rendered as a photo. */
export const isPhoto = (value) => typeof value === 'string' && value.startsWith('data:image/jpeg;base64,');

function load(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("That file couldn't be read as an image."));
    img.src = src;
  });
}

/**
 * A File (new upload) or a stored photo → { img, src, release }.
 * `src` stays valid for <img> tags until `release()` is called.
 * Throws an Error with a user-facing message.
 */
export async function loadPhotoSource(source) {
  if (typeof source === 'string') {
    if (!isPhoto(source)) throw new Error("That photo can't be edited.");
    return { img: await load(source), src: source, release() {} };
  }
  if (!source) throw new Error('No file chosen.');
  if (!PHOTO_TYPES.includes(source.type)) throw new Error('Use a JPG, PNG, WebP or GIF image.');
  if (source.size > MAX_BYTES) throw new Error('That image is over 10 MB. Pick a smaller one.');

  const url = URL.createObjectURL(source);
  const release = () => URL.revokeObjectURL(url);
  try {
    const img = await load(url);
    if (Math.min(img.naturalWidth, img.naturalHeight) < MIN_SIDE) {
      throw new Error(`That image is too small. Use one at least ${MIN_SIDE} × ${MIN_SIDE} px.`);
    }
    return { img, src: url, release };
  } catch (err) {
    release();
    throw err;
  }
}

/*
 * Framing model, in "frame units" (the square frame is 1 × 1):
 * - zoom 1 = the image's short side exactly fills the frame ("cover").
 * - x, y   = how far the image's centre sits from the frame's centre.
 * The image must always cover the frame, so x and y are clamped.
 */

export const MIN_ZOOM = 1;

/** Largest useful zoom: stop before the framed area drops below ~96 source px. */
export const maxZoom = (img) => Math.max(1, Math.min(5, Math.min(img.naturalWidth, img.naturalHeight) / 96));

/** Displayed image size in frame units at a zoom. */
export function coverSize(img, zoom) {
  const short = Math.min(img.naturalWidth, img.naturalHeight);
  return { w: (img.naturalWidth / short) * zoom, h: (img.naturalHeight / short) * zoom };
}

export function clampFrame(img, { zoom, x, y }) {
  const z = Math.min(Math.max(zoom, MIN_ZOOM), maxZoom(img));
  const { w, h } = coverSize(img, z);
  const mx = (w - 1) / 2;
  const my = (h - 1) / 2;
  return { zoom: z, x: Math.min(Math.max(x, -mx), mx), y: Math.min(Math.max(y, -my), my) };
}

/** Renders the framed square to a JPEG data URL. */
export function renderFrame(img, frame) {
  const { zoom, x, y } = clampFrame(img, frame);
  const short = Math.min(img.naturalWidth, img.naturalHeight);
  const side = short / zoom; // framed square, in source px
  const pxPerUnit = short / zoom; // source px per frame unit
  const sx = img.naturalWidth / 2 - x * pxPerUnit - side / 2;
  const sy = img.naturalHeight / 2 - y * pxPerUnit - side / 2;

  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_SIZE;
  canvas.height = PHOTO_SIZE;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff'; // transparent PNGs get a white background, not black
  ctx.fillRect(0, 0, PHOTO_SIZE, PHOTO_SIZE);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, sx, sy, side, side, 0, 0, PHOTO_SIZE, PHOTO_SIZE);
  return canvas.toDataURL('image/jpeg', 0.86);
}
