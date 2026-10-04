// Firebaseの設定値。ウェブアプリの設定は秘匿情報ではないため、公開リポジトリに置いても問題ありません。
// null のままの間は、曲とセットリストを端末内（IndexedDB）にだけ保存します（端末間の同期なし）。
export const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBA6TS8k4X1uLxoONjDsqDO--eGEHuex_k",
  authDomain: "kashi-a8e32.firebaseapp.com",
  projectId: "kashi-a8e32",
  storageBucket: "kashi-a8e32.firebasestorage.app",
  messagingSenderId: "889577943480",
  appId: "1:889577943480:web:237374fdb5ae1073159f4d",
};

// 同じ値を使う端末同士で曲とセットリストが共有されます。
export const WORKSPACE_ID = 'live-chord-main';
