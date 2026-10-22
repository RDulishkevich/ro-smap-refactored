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

function mediaKeyFor(
  fileName: string,
  contentType: string,
  login: string,
  userId: string | undefined,
  opts?: UploadMediaOpts,
) {
  const safeName = String(fileName || `file_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const uid = String(userId || login).replace(/[^a-zA-Z0-9_\-]/g, '_');
  const isImage = /^image\//i.test(contentType);
  const isAudio = /^audio\//i.test(contentType);
  const kind = opts?.kind || (isAudio ? 'sound' : isImage ? 'avatar' : 'sound');
  if (kind === 'sound') {
    const sid = String(opts?.soundId || newSoundId()).replace(/[^a-zA-Z0-9_\-]/g, '_');
    return `media/sounds/${sid}/${safeName}`;
  }
  if (kind === 'avatar') {
    return `media/avatars/${uid}/${safeName}`;
  }
  return `uploads/${login}/${safeName}`;
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
  const type = contentType || blob.type || 'application/octet-stream';
  const key = mediaKeyFor(fileName, type, login, user?.userId, opts);

  onProgress?.({ stage: 'presign', loaded: 0, total: blob.size, ratio: 0 });
  const pre = await apiPresignUpload(key, type, blob.size) as { uploadUrl?: string; publicUrl?: string };
  if (!pre.uploadUrl) throw Object.assign(new Error('Нет URL загрузки'), { code: 'presign_failed' });

  await putWithProgress(pre.uploadUrl, blob, type, onProgress);
  return pre.publicUrl || `${BUCKET_URL}/${key}`;
}
