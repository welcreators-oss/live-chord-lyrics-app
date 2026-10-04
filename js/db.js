// データ保存層。
// - 曲(songs)・セットリスト(setlists): Firebase設定時はFirestoreに保存し、PC/iPad間で共有する。
//   Firebase未設定（firebase-config.js の FIREBASE_CONFIG が null）の間は端末内のIndexedDBに保存する。
// - 画像(images)・設定(settings): 端末ごとのもので、従来どおり端末内のIndexedDBにのみ保存する。
// 外部送信はFirestoreへの曲・セットリストの同期に限られ、画像は一切送信しない。
import { FIREBASE_CONFIG } from './firebase-config.js';

const DB_NAME = 'live-chord-app-db';
const DB_VERSION = 1;
const SYNCED_STORES = ['songs', 'setlists'];
const syncEnabled = !!FIREBASE_CONFIG;

let dbPromise = null;
let syncPromise = null;
let migrationPromise = null;

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

async function localGetAll(storeName) {
  const store = await tx(storeName, 'readonly');
  return wrapReq(store.getAll());
}

async function localGet(storeName, id) {
  const store = await tx(storeName, 'readonly');
  return wrapReq(store.get(id));
}

async function localPut(storeName, value) {
  const store = await tx(storeName, 'readwrite');
  await wrapReq(store.put(value));
  return value;
}

async function localRemove(storeName, id) {
  const store = await tx(storeName, 'readwrite');
  return wrapReq(store.delete(id));
}

function loadSync() {
  if (!syncPromise) syncPromise = import('./sync.js');
  return syncPromise;
}

const usesCloud = (storeName) => syncEnabled && SYNCED_STORES.includes(storeName);

// 初回のみ、端末内に既にある曲・セットリストをクラウドへ移す（既存データの取り込み漏れ防止）
function ensureMigrated() {
  if (!migrationPromise) migrationPromise = migrateLocalToCloud();
  return migrationPromise;
}

async function migrateLocalToCloud() {
  const flag = await localGet('settings', 'cloudMigrated');
  if (flag && flag.value) return;
  const sync = await loadSync();
  for (const name of SYNCED_STORES) {
    const local = await localGetAll(name);
    const remote = await sync.syncGetAll(name);
    const remoteIds = new Set(remote.map((r) => r.id));
    for (const item of local) {
      if (!remoteIds.has(item.id)) sync.syncPut(name, item);
    }
  }
  await localPut('settings', { key: 'cloudMigrated', value: true });
}

export function uuid() {
  return (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  }));
}

export async function getAll(storeName) {
  if (!usesCloud(storeName)) return localGetAll(storeName);
  await ensureMigrated();
  const sync = await loadSync();
  return sync.syncGetAll(storeName);
}

export async function get(storeName, id) {
  if (!usesCloud(storeName)) return localGet(storeName, id);
  await ensureMigrated();
  const sync = await loadSync();
  return sync.syncGet(storeName, id);
}

export async function put(storeName, value) {
  if (!usesCloud(storeName)) return localPut(storeName, value);
  await ensureMigrated();
  const sync = await loadSync();
  return sync.syncPut(storeName, value);
}

export async function remove(storeName, id) {
  if (!usesCloud(storeName)) return localRemove(storeName, id);
  await ensureMigrated();
  const sync = await loadSync();
  return sync.syncRemove(storeName, id);
}

export async function getSetting(key, defaultValue = null) {
  const row = await localGet('settings', key);
  return row ? row.value : defaultValue;
}

export async function setSetting(key, value) {
  return localPut('settings', { key, value });
}

export async function clearAll() {
  const db = await openDB();
  const names = ['songs', 'images', 'setlists', 'settings'];
  await Promise.all(names.map((name) => wrapReq(db.transaction(name, 'readwrite').objectStore(name).clear())));
  if (syncEnabled) {
    const sync = await loadSync();
    for (const name of SYNCED_STORES) await sync.syncClearAll(name);
  }
}
