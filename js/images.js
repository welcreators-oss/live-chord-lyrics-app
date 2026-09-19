// 画像（背景・コード譜写真）の保存とObjectURL管理
import { get, put, remove, getAll, uuid } from './db.js';

const urlCache = new Map();

export async function saveImage(blob, name, kind) {
  const id = uuid();
  await put('images', { id, blob, name: name || '', kind, createdAt: Date.now() });
  return id;
}

export async function getImageRecord(id) {
  return get('images', id);
}

export async function getImageUrl(id) {
  if (!id) return null;
  if (urlCache.has(id)) return urlCache.get(id);
  const rec = await get('images', id);
  if (!rec) return null;
  const url = URL.createObjectURL(rec.blob);
  urlCache.set(id, url);
  return url;
}

export async function deleteImage(id) {
  if (urlCache.has(id)) {
    URL.revokeObjectURL(urlCache.get(id));
    urlCache.delete(id);
  }
  return remove('images', id);
}

export async function listImagesByKind(kind) {
  const all = await getAll('images');
  return all.filter((img) => img.kind === kind).sort((a, b) => a.createdAt - b.createdAt);
}

export function fileToBlob(file) {
  return file;
}
