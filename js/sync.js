// Firebase Firestoreによる曲・セットリストの同期。
// 匿名認証で全端末が同じワークスペース配下のデータを読み書きする。
// Firestoreのローカルキャッシュ（IndexedDB）によりオフラインでも読み書きでき、再接続時に自動で送信される。
import { initializeApp } from '../vendor/firebase/firebase-app.js';
import { getAuth, onAuthStateChanged, signInAnonymously } from '../vendor/firebase/firebase-auth.js';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
} from '../vendor/firebase/firebase-firestore.js';
import { FIREBASE_CONFIG, WORKSPACE_ID } from './firebase-config.js';

const app = initializeApp(FIREBASE_CONFIG);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
});

let authed = false;
const ready = new Promise((resolve) => {
  const unsubscribe = onAuthStateChanged(auth, (user) => {
    if (user) {
      authed = true;
      unsubscribe();
      resolve();
    } else {
      signInAnonymously(auth).catch((e) => console.error('匿名サインインに失敗しました', e));
    }
  });
});

const collectionPath = (name) => `workspaces/${WORKSPACE_ID}/${name}`;
const plain = (value) => JSON.parse(JSON.stringify(value));
// 通信できない状態でも、キャッシュからの読み出しが止まらないよう認証待ちに上限を設ける
const waitAuth = () => Promise.race([ready, new Promise((r) => setTimeout(r, 4000))]);

function runWhenAuthed(fn) {
  const task = authed ? fn() : ready.then(fn);
  task.catch((e) => console.error('同期に失敗しました', e));
}

export async function syncGetAll(name) {
  await waitAuth();
  const snap = await getDocs(collection(db, collectionPath(name)));
  return snap.docs.map((d) => d.data());
}

export async function syncGet(name, id) {
  await waitAuth();
  const snap = await getDoc(doc(db, collectionPath(name), id));
  return snap.exists() ? snap.data() : undefined;
}

export function syncPut(name, value) {
  const data = plain(value);
  runWhenAuthed(() => setDoc(doc(db, collectionPath(name), data.id), data));
  return value;
}

export function syncRemove(name, id) {
  runWhenAuthed(() => deleteDoc(doc(db, collectionPath(name), id)));
}

export async function syncClearAll(name) {
  await waitAuth();
  const snap = await getDocs(collection(db, collectionPath(name)));
  await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
}
