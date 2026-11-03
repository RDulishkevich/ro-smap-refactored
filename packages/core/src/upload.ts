import { BUCKET_URL } from './config';
import { apiPresignUpload } from './api';
import { newSoundId } from './ids';
import { readStoredUser } from './session';

export type UploadProgress = {
  stage: 'presign' | 'put' | 'done';
  loaded: number;
  total: number;
  /** 0..1 during put; 0 at presign; 1 at done */
  ratio: number;
};

export type UploadMediaOpts = {
  /** avatar → media/avatars; sound → media/sounds (audio + photos) */
  kind?: 'avatar' | 'sound';
  /** Reuse same snd_… for audio + photos of one card */
  soundId?: string;
};

const MAX_IMAGE_EDGE = 1600;
const IMAGE_QUALITY = 0.82;
const REENCODE_MIN_BYTES = 400_000;

function putWithProgress(
  url: string,
  blob: Blob,
  contentType: string,
  onProgress?: (p: UploadProgress) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable) return;
      onProgress?.({
        stage: 'put',
        loaded: ev.loaded,
        total: ev.total,
        ratio: ev.total ? ev.loaded / ev.total : 0,
      });
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.({ stage: 'done', loaded: blob.size, total: blob.size, ratio: 1 });
        resolve();
      } else {
        reject(Object.assign(new Error('Ошибка загрузки файла в облако'), {
          code: xhr.status === 403 ? 'presign_expired' : 'upload_failed',
          status: xhr.status,
        }));
      }
    };
    xhr.onerror = () => reject(Object.assign(new Error('Сеть: не удалось отправить файл'), { code: 'network' }));
    xhr.onabort = () => reject(Object.assign(new Error('Загрузка отменена'), { code: 'aborted' }));
    xhr.send(blob);
  });
}

function canvasToBlob(canvas: HTMLCanvasElement | OffscreenCanvas, type: string, quality: number): Promise<Blob | null> {
  if ('convertToBlob' in canvas && typeof canvas.convertToBlob === 'function') {
    return canvas.convertToBlob({ type, quality }).catch(() => null);
  }
  return new Promise((resolve) => {
    (canvas as HTMLCanvasElement).toBlob((blob) => resolve(blob), type, quality);
  });
}

async function decodeBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob, { imageOrientation: 'from-image' } as ImageBitmapOptions);
    } catch {
      /* fall through — some types (HEIC) need an <img> decode */
    }
  }
  return await new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('image_load_failed'));
    };
    img.src = url;
  });
}

function closeDecoded(img: ImageBitmap | HTMLImageElement) {
  if ('close' in img && typeof img.close === 'function') img.close();
}

/** Downscale still images to max 1600px long edge. Applies EXIF orientation. GIF/SVG stay as-is. */
export async function downscaleImageBlob(blob: Blob, contentType: string): Promise<{ blob: Blob; type: string }> {
  const type = contentType || blob.type || '';
  if (!/^image\//i.test(type)) return { blob, type: type || blob.type || 'application/octet-stream' };
  if (/^image\/(gif|svg)/i.test(type)) return { blob, type };

  let decoded: ImageBitmap | HTMLImageElement | null = null;
  try {
    decoded = await decodeBitmap(blob);
    const width = decoded.width || 1;
    const height = decoded.height || 1;
    const long = Math.max(width, height);
    const scale = long > MAX_IMAGE_EDGE ? MAX_IMAGE_EDGE / long : 1;
    if (scale === 1 && blob.size <= REENCODE_MIN_BYTES) return { blob, type };

    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));
    const canvas = typeof OffscreenCanvas !== 'undefined'
      ? new OffscreenCanvas(w, h)
      : Object.assign(document.createElement('canvas'), { width: w, height: h });
    if (!('convertToBlob' in canvas)) {
      (canvas as HTMLCanvasElement).width = w;
      (canvas as HTMLCanvasElement).height = h;
    }
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (!ctx) return { blob, type };
    ctx.drawImage(decoded, 0, 0, w, h);

    let out: Blob | null = await canvasToBlob(canvas, 'image/webp', IMAGE_QUALITY);
    let outType = 'image/webp';
    if (!out || !out.size || (out.type && !/webp/i.test(out.type))) {
      out = await canvasToBlob(canvas, 'image/jpeg', IMAGE_QUALITY);
      outType = 'image/jpeg';
    }
    if (!out || !out.size) return { blob, type };
    if (scale === 1 && out.size >= blob.size) return { blob, type };
    return { blob: out, type: outType };
  } catch {
    return { blob, type: type || blob.type || 'image/jpeg' };
  } finally {
    if (decoded) closeDecoded(decoded);
  }
}

function opaqueFileName(ext: string) {
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  const id = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  const safeExt = String(ext || '').replace(/[^a-zA-Z0-9.]/g, '').slice(0, 8);
  return safeExt ? `${id}${safeExt.startsWith('.') ? safeExt : `.${safeExt}`}` : id;
}

function extFor(fileName: string, contentType: string) {
  if (/^image\/webp$/i.test(contentType)) return '.webp';
  if (/^image\/jpe?g$/i.test(contentType)) return '.jpg';
  if (/^image\/png$/i.test(contentType)) return '.png';
  if (/^audio\/(wav|x-wav|wave)$/i.test(contentType)) return '.wav';
  if (/^audio\/mpeg|^audio\/mp3$/i.test(contentType)) return '.mp3';
  if (/^video\/mp4$/i.test(contentType)) return '.mp4';
  if (/^video\/webm$/i.test(contentType)) return '.webm';
  if (/^video\/quicktime$/i.test(contentType)) return '.mov';
  const fromName = String(fileName || '').match(/(\.[a-z0-9]{1,8})$/i)?.[1];
  return fromName || '';
}

function mediaKeyFor(
  fileName: string,
  contentType: string,
  login: string,
  userId: string | undefined,
  opts?: UploadMediaOpts,
) {
  const uid = String(userId || login).replace(/[^a-zA-Z0-9_\-]/g, '_');
  const isImage = /^image\//i.test(contentType);
  const isAudio = /^audio\//i.test(contentType);
  const isVideo = /^video\//i.test(contentType);
  const kind = opts?.kind || (isAudio ? 'sound' : (isImage || isVideo) ? 'avatar' : 'avatar');
  const name = opaqueFileName(extFor(fileName, contentType));
  if (kind === 'sound') {
    const sid = String(opts?.soundId || newSoundId()).replace(/[^a-zA-Z0-9_\-]/g, '_');
    return `media/sounds/${sid}/${name}`;
  }
  return `media/avatars/${uid}/${name}`;
}

/** Parse a public bucket object key from an https URL or relative media/uploads path. */
export function publicMediaKeyFromUrl(url: string): string {
  const s = String(url || '').split('?')[0].trim();
  if (!s) return '';
  const abs = s.match(/storage\.yandexcloud\.net\/rosmap2026\/(.+)$/i);
  if (abs) {
    try { return decodeURIComponent(abs[1]); } catch { return abs[1]; }
  }
  const rel = s.replace(/^\/+/, '');
  if (rel.startsWith('media/') || rel.startsWith('uploads/')) return rel;
  return '';
}

export async function uploadUserMedia(
  blob: Blob,
  fileName: string,
  contentType?: string,
  onProgress?: (p: UploadProgress) => void,
  opts?: UploadMediaOpts,
) {
  const user = readStoredUser();
  const login = user?.loginName;
  if (!login) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });
  let type = contentType || blob.type || 'application/octet-stream';
  let body = blob;
  if (/^image\//i.test(type)) {
    onProgress?.({ stage: 'presign', loaded: 0, total: blob.size, ratio: 0 });
    const scaled = await downscaleImageBlob(blob, type);
    body = scaled.blob;
    type = scaled.type;
  }

  const key = mediaKeyFor(fileName, type, login, user?.userId, opts);

  onProgress?.({ stage: 'presign', loaded: 0, total: body.size, ratio: 0 });
  const pre = await apiPresignUpload(key, type, body.size) as { uploadUrl?: string; publicUrl?: string };
  if (!pre.uploadUrl) throw Object.assign(new Error('Нет URL загрузки'), { code: 'presign_failed' });

  await putWithProgress(pre.uploadUrl, body, type, onProgress);
  return pre.publicUrl || `${BUCKET_URL}/${key}`;
}
