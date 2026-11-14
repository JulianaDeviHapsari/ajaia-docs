import path from 'node:path';
import mammoth from 'mammoth';
import { marked } from 'marked';
import { cleanHtml, escapeHtml } from './sanitize.js';

export const SUPPORTED_EXTENSIONS = ['.txt', '.md', '.docx'];
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024; // 2 MB

export class ImportError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

function textToHtml(text) {
  const paragraphs = text.replace(/\r\n/g, '\n').split(/\n{2,}/);
  return paragraphs
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
}

/** Convert an uploaded file buffer to { title, html }. */
export async function importFile(originalName, buffer) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (!SUPPORTED_EXTENSIONS.includes(ext)) {
    throw new ImportError(
      `Tipe file ${ext || '(tanpa ekstensi)'} tidak didukung. Gunakan: ${SUPPORTED_EXTENSIONS.join(', ')}`,
    );
  }
  if (!buffer || buffer.length === 0) throw new ImportError('File kosong.');

  const title = path.basename(originalName, ext).slice(0, 120) || 'Dokumen impor';
  let html;
  try {
    if (ext === '.txt') {
      html = textToHtml(buffer.toString('utf8'));
    } else if (ext === '.md') {
      html = await marked.parse(buffer.toString('utf8'));
    } else {
      const result = await mammoth.convertToHtml({ buffer });
      html = result.value;
    }
  } catch {
    throw new ImportError('File tidak dapat dibaca. Pastikan file tidak rusak.');
  }
  return { title, html: cleanHtml(html) || '<p></p>' };
}
