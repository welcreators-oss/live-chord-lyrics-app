// 曲データのCRUDとデータ構造ヘルパー
import { get, put, remove, getAll, uuid } from './db.js';

// Song: { id, title, order, backgroundImageIds:[id], blocks:[Block], updatedAt }
// Block: { id, lyricLines:[string], chords:[{line, col, text}] }

export function newBlock() {
  return { id: uuid(), lyricLines: [''], chords: [] };
}

export function newSong(title) {
  return {
    id: uuid(),
    title: title || '無題の曲',
    order: Date.now(),
    backgroundImageIds: [],
    blocks: [newBlock()],
    updatedAt: Date.now(),
  };
}

export async function listSongs() {
  const songs = await getAll('songs');
  return songs.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

export async function getSong(id) {
  return get('songs', id);
}

export async function saveSong(song) {
  song.updatedAt = Date.now();
  return put('songs', song);
}

export async function deleteSong(id) {
  return remove('songs', id);
}

// OCRで得たプレーンテキストを1ブロックの歌詞行に変換
export function textToLyricLines(text) {
  return text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.replace(/\s+$/g, ''))
    .filter((l, i, arr) => !(l === '' && i === arr.length - 1));
}
