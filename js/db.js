// IndexedDBラッパー。全データは端末内にのみ保存し、外部送信は一切行わない。
const DB_NAME = 'live-chord-app-db';
const DB_VERSION = 1;

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('songs')) {
        db.createObjectStore('songs', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('setlists')) {
        db.createObjectStore('setlists', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

function wrapReq(req) {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function uuid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }));
}

export async function getAll(storeName) {
  const store = await tx(storeName, 'readonly');
  return wrapReq(store.getAll());
}

export async function get(storeName, id) {
  const store = await tx(storeName, 'readonly');
  return wrapReq(store.get(id));
}

export async function put(storeName, value) {
  const store = await tx(storeName, 'readwrite');
  await wrapReq(store.put(value));
  return value;
}

export async function remove(storeName, id) {
  const store = await tx(storeName, 'readwrite');
  return wrapReq(store.delete(id));
}

export async function getSetting(key, defaultValue = null) {
  const row = await get('settings', key);
  return row ? row.value : defaultValue;
}

export async function setSetting(key, value) {
  return put('settings', { key, value });
}

export async function clearAll() {
  const db = await openDB();
  const names = ['songs', 'images', 'setlists', 'settings'];
  await Promise.all(names.map((name) => wrapReq(db.transaction(name, 'readwrite').objectStore(name).clear())));
}
