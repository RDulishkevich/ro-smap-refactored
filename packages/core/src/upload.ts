import { BUCKET_URL } from './config';
import { apiPresignUpload } from './api';
import { readStoredUser } from './session';

export async function uploadUserMedia(blob: Blob, fileName: string, contentType?: string) {
  const login = readStoredUser()?.loginName;
  if (!login) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });
  const type = contentType || blob.type || 'application/octet-stream';
  const safeName = String(fileName || `file_${Date.now()}`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const key = `uploads/${login}/${safeName}`;
  const pre = await apiPresignUpload(key, type, blob.size) as { uploadUrl?: string; publicUrl?: string };
  if (!pre.uploadUrl) throw new Error('Нет URL загрузки');
  const putRes = await fetch(pre.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': type },
    body: blob,
  });
  if (!putRes.ok) throw new Error('Ошибка загрузки файла в облако');
  return pre.publicUrl || `${BUCKET_URL}/${key}`;
}
