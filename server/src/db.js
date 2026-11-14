import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';

export const SEED_USERS = [
  { id: 1, name: 'Alice Owner', email: 'alice@example.com' },
  { id: 2, name: 'Bob Editor', email: 'bob@example.com' },
  { id: 3, name: 'Carol Viewer', email: 'carol@example.com' },
];

const WELCOME_HTML =
  '<h1>Selamat datang di Ajaia Docs</h1>' +
  '<p>Ini dokumen contoh milik <strong>Alice</strong>. Coba <em>format teks</em>, ' +
  '<u>garis bawah</u>, judul, dan daftar.</p>' +
  '<ul><li>Dokumen ini sudah dibagikan ke Bob (editor) dan Carol (viewer)</li>' +
  '<li>Masuk sebagai pengguna lain untuk melihat perbedaan akses</li></ul>';

export function openDb(file = ':memory:') {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(`
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      version INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS shares (
      document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK (role IN ('editor','viewer')),
      PRIMARY KEY (document_id, user_id)
    );
  `);
  const insertUser = db.prepare('INSERT OR IGNORE INTO users (id, name, email) VALUES (?, ?, ?)');
  for (const u of SEED_USERS) insertUser.run(u.id, u.name, u.email);

  const hasDocs = db.prepare('SELECT COUNT(*) AS n FROM documents').get().n > 0;
  if (!hasDocs) {
    const r = db
      .prepare('INSERT INTO documents (owner_id, title, content) VALUES (1, ?, ?)')
      .run('Dokumen Contoh (dibagikan)', WELCOME_HTML);
    const id = Number(r.lastInsertRowid);
    db.prepare('INSERT INTO shares VALUES (?, 2, ?)').run(id, 'editor');
    db.prepare('INSERT INTO shares VALUES (?, 3, ?)').run(id, 'viewer');
  }
  return db;
}
