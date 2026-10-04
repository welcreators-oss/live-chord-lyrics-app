// Firebaseの設定値。ウェブアプリの設定は秘匿情報ではないため、公開リポジトリに置いても問題ありません。
// null のままの間は、曲とセットリストを端末内（IndexedDB）にだけ保存します（端末間の同期なし）。
export const FIREBASE_CONFIG = null;

// 同じ値を使う端末同士で曲とセットリストが共有されます。
export const WORKSPACE_ID = 'live-chord-main';
