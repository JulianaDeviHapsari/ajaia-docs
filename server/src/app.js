import express from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { cleanHtml } from './sanitize.js';
import { importFile, MAX_UPLOAD_BYTES, SUPPORTED_EXTENSIONS } from './importer.js';

const MAX_TITLE = 120;
const MAX_CONTENT = 1_000_000; // ~1 MB of HTML

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function validateTitle(title) {
  if (typeof title !== 'string' || !title.trim()) throw new HttpError(400, 'Judul tidak boleh kosong.');
  if (title.trim().length > MAX_TITLE) throw new HttpError(400, `Judul maksimal ${MAX_TITLE} karakter.`);
  return title.trim();
}

function validateContent(content) {
  if (typeof content !== 'string') throw new HttpError(400, 'Konten harus berupa teks HTML.');
  if (content.length > MAX_CONTENT) throw new HttpError(413, 'Konten terlalu besar.');
  return cleanHtml(content);
}

export function createApp({ dbFile = ':memory:', clientDir } = {}) {
  const db = openDb(dbFile);
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES } });

  // ---- lightweight "auth": the client sends X-User-Id. Documented as a mock. ----
  const getUser = db.prepare('SELECT id, name, email FROM users WHERE id = ?');
  app.use('/api', (req, res, next) => {
    if (req.path === '/users' || req.path === '/health') return next();
    const id = Number(req.header('x-user-id'));
    const user = Number.isInteger(id) ? getUser.get(id) : null;
    if (!user) return next(new HttpError(401, 'Silakan masuk terlebih dahulu.'));
    req.user = user;
    next();
  });

  // ---- access logic: single place that decides who can do what ----
  const getDoc = db.prepare(`
    SELECT d.*, u.name AS owner_name, u.email AS owner_email
    FROM documents d JOIN users u ON u.id = d.owner_id WHERE d.id = ?`);
  const getShare = db.prepare('SELECT role FROM shares WHERE document_id = ? AND user_id = ?');

  function roleFor(doc, userId) {
    if (doc.owner_id === userId) return 'owner';
    return getShare.get(doc.id, userId)?.role ?? null;
  }

  function loadDoc(req, need) {
    const id = Number(req.params.id);
    const doc = Number.isInteger(id) ? getDoc.get(id) : null;
    if (!doc) throw new HttpError(404, 'Dokumen tidak ditemukan.');
    const role = roleFor(doc, req.user.id);
    // 404 (not 403) for strangers so we don't leak which ids exist.
    if (!role) throw new HttpError(404, 'Dokumen tidak ditemukan.');
    const rank = { viewer: 1, editor: 2, owner: 3 };
    if (rank[role] < rank[need]) throw new HttpError(403, 'Anda tidak memiliki izin untuk tindakan ini.');
    return { doc, role };
  }

  const present = (doc, role) => ({
    id: doc.id,
    title: doc.title,
    content: doc.content,
    version: doc.version,
    role,
    owner: { id: doc.owner_id, name: doc.owner_name, email: doc.owner_email },
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  });

  // ---- routes ----
  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.get('/api/users', (_req, res) => res.json(db.prepare('SELECT id, name, email FROM users ORDER BY id').all()));

  app.get('/api/docs', (req, res) => {
    const owned = db
      .prepare(`SELECT d.id, d.title, d.updated_at AS updatedAt,
                (SELECT COUNT(*) FROM shares s WHERE s.document_id = d.id) AS shareCount
                FROM documents d WHERE d.owner_id = ? ORDER BY d.updated_at DESC, d.id DESC`)
      .all(req.user.id);
    const shared = db
      .prepare(`SELECT d.id, d.title, d.updated_at AS updatedAt, s.role, u.name AS ownerName
                FROM shares s JOIN documents d ON d.id = s.document_id JOIN users u ON u.id = d.owner_id
                WHERE s.user_id = ? ORDER BY d.updated_at DESC, d.id DESC`)
      .all(req.user.id);
    res.json({ owned, shared });
  });

  app.post('/api/docs', (req, res) => {
    const title = req.body?.title === undefined ? 'Dokumen tanpa judul' : validateTitle(req.body.title);
    const content = req.body?.content === undefined ? '<p></p>' : validateContent(req.body.content);
    const r = db
      .prepare('INSERT INTO documents (owner_id, title, content) VALUES (?, ?, ?)')
      .run(req.user.id, title, content);
    const doc = getDoc.get(Number(r.lastInsertRowid));
    res.status(201).json(present(doc, 'owner'));
  });

  app.post(
    '/api/docs/import',
    upload.single('file'),
    wrap(async (req, res) => {
      if (!req.file) throw new HttpError(400, `Pilih file untuk diunggah (${SUPPORTED_EXTENSIONS.join(', ')}).`);
      const { title, html } = await importFile(req.file.originalname, req.file.buffer);
      const r = db
        .prepare('INSERT INTO documents (owner_id, title, content) VALUES (?, ?, ?)')
        .run(req.user.id, title, html);
      res.status(201).json(present(getDoc.get(Number(r.lastInsertRowid)), 'owner'));
    }),
  );

  app.get('/api/docs/:id', (req, res) => {
    const { doc, role } = loadDoc(req, 'viewer');
    const out = present(doc, role);
    if (role === 'owner') {
      out.shares = db
        .prepare(`SELECT u.id AS userId, u.name, u.email, s.role FROM shares s
                  JOIN users u ON u.id = s.user_id WHERE s.document_id = ? ORDER BY u.name`)
        .all(doc.id);
    }
    res.json(out);
  });

  app.patch('/api/docs/:id', (req, res) => {
    const { doc, role } = loadDoc(req, 'editor');
    const { title, content, version } = req.body ?? {};
    if (title === undefined && content === undefined) throw new HttpError(400, 'Tidak ada perubahan.');
    if (version !== undefined && version !== doc.version) {
      throw new HttpError(409, 'Dokumen telah diubah oleh pengguna lain. Muat ulang untuk melihat versi terbaru.');
    }
    const newTitle = title === undefined ? doc.title : validateTitle(title);
    const newContent = content === undefined ? doc.content : validateContent(content);
    db.prepare(
      `UPDATE documents SET title = ?, content = ?, version = version + 1, updated_at = datetime('now') WHERE id = ?`,
    ).run(newTitle, newContent, doc.id);
    res.json(present(getDoc.get(doc.id), role));
  });

  app.delete('/api/docs/:id', (req, res) => {
    const { doc } = loadDoc(req, 'owner');
    db.prepare('DELETE FROM documents WHERE id = ?').run(doc.id);
    res.status(204).end();
  });

  app.post('/api/docs/:id/shares', (req, res) => {
    const { doc } = loadDoc(req, 'owner');
    const email = String(req.body?.email ?? '').trim().toLowerCase();
    const role = req.body?.role;
    if (!['editor', 'viewer'].includes(role)) throw new HttpError(400, 'Peran harus "editor" atau "viewer".');
    const target = db.prepare('SELECT id, name, email FROM users WHERE lower(email) = ?').get(email);
    if (!target) throw new HttpError(404, 'Pengguna dengan email tersebut tidak ditemukan.');
    if (target.id === doc.owner_id) throw new HttpError(400, 'Pemilik dokumen sudah memiliki akses penuh.');
    db.prepare(
      `INSERT INTO shares (document_id, user_id, role) VALUES (?, ?, ?)
       ON CONFLICT(document_id, user_id) DO UPDATE SET role = excluded.role`,
    ).run(doc.id, target.id, role);
    res.status(201).json({ userId: target.id, name: target.name, email: target.email, role });
  });

  app.delete('/api/docs/:id/shares/:userId', (req, res) => {
    const { doc } = loadDoc(req, 'owner');
    db.prepare('DELETE FROM shares WHERE document_id = ? AND user_id = ?').run(doc.id, Number(req.params.userId));
    res.status(204).end();
  });

  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Endpoint tidak ditemukan.')));

  // ---- serve built client (single deployable unit) ----
  if (clientDir && fs.existsSync(clientDir)) {
    app.use(express.static(clientDir));
    // SPA fallback (Express 5 no longer accepts a bare '*' route path).
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api')) return next();
      res.sendFile(path.join(clientDir, 'index.html'));
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err instanceof multer.MulterError) {
      const msg = err.code === 'LIMIT_FILE_SIZE' ? `File terlalu besar (maks ${MAX_UPLOAD_BYTES / 1024 / 1024} MB).` : err.message;
      return res.status(400).json({ error: msg });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON tidak valid.' });
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Permintaan terlalu besar.' });
    const status = err.status || 500;
    if (status === 500) console.error(err);
    res.status(status).json({ error: status === 500 ? 'Terjadi kesalahan pada server.' : err.message });
  });

  app.locals.db = db;
  return app;
}

export const defaultClientDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../client/dist');
