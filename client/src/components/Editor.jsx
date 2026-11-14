import { useCallback, useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit'; // includes bold, italic, underline, headings, lists
import { api } from '../api.js';
import { go } from '../App.jsx';
import ShareDialog from './ShareDialog.jsx';

const SAVE_DELAY_MS = 800;
const ROLE_LABEL = { owner: 'Pemilik', editor: 'Bisa mengedit', viewer: 'Hanya lihat' };

function Toolbar({ editor }) {
  // Re-render the toolbar when selection/format changes.
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      underline: e.isActive('underline'),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      block: e.isActive('heading', { level: 1 }) ? 'h1' : e.isActive('heading', { level: 2 }) ? 'h2' : e.isActive('heading', { level: 3 }) ? 'h3' : 'p',
    }),
  });
  const run = (fn) => () => fn(editor.chain().focus()).run();
  const onBlock = (e) => {
    const v = e.target.value;
    const chain = editor.chain().focus();
    if (v === 'p') chain.setParagraph().run();
    else chain.setHeading({ level: Number(v[1]) }).run();
  };

  return (
    <div
      className="toolbar"
      role="toolbar"
      aria-label="Pemformatan teks"
      // Keep focus (and the selection) in the editor when a toolbar button is pressed.
      onMouseDown={(e) => e.target.closest('button') && e.preventDefault()}
    >
      <select value={s.block} onChange={onBlock} aria-label="Gaya teks">
        <option value="p">Teks biasa</option>
        <option value="h1">Judul 1</option>
        <option value="h2">Judul 2</option>
        <option value="h3">Judul 3</option>
      </select>
      <span className="sep" />
      <button className={s.bold ? 'on' : ''} onClick={run((c) => c.toggleBold())} title="Tebal (Ctrl+B)" aria-label="Tebal"><b>B</b></button>
      <button className={s.italic ? 'on' : ''} onClick={run((c) => c.toggleItalic())} title="Miring (Ctrl+I)" aria-label="Miring"><i>I</i></button>
      <button className={s.underline ? 'on' : ''} onClick={run((c) => c.toggleUnderline())} title="Garis bawah (Ctrl+U)" aria-label="Garis bawah"><u>U</u></button>
      <span className="sep" />
      <button className={s.bullet ? 'on' : ''} onClick={run((c) => c.toggleBulletList())} title="Daftar berpoin" aria-label="Daftar berpoin">• Daftar</button>
      <button className={s.ordered ? 'on' : ''} onClick={run((c) => c.toggleOrderedList())} title="Daftar bernomor" aria-label="Daftar bernomor">1. Daftar</button>
    </div>
  );
}

// Outer shell: loads the document, then mounts the editor with STABLE options.
// (useEditor re-applies options on every render, so `editable`/`content` must never change
// after mount. Mounting only once data is ready also avoids a flash of an editable, empty page.)
export default function Editor({ docId }) {
  const [initial, setInitial] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api
      .getDoc(docId)
      .then((d) => !cancelled && setInitial(d))
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [docId]);

  if (error) {
    return (
      <div className="page">
        <div className="alert error">{error}</div>
        <a href="#/" className="btn">← Kembali ke daftar</a>
      </div>
    );
  }
  if (!initial) return <div className="center muted">Memuat dokumen…</div>;
  return <EditorInner initial={initial} />;
}

function EditorInner({ initial }) {
  const docId = initial.id;
  const [doc, setDoc] = useState(initial);
  const [title, setTitle] = useState(initial.title);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('saved'); // saved | saving | dirty | error | conflict
  const [showShare, setShowShare] = useState(false);

  const versionRef = useRef(initial.version);
  const timerRef = useRef(null);
  const pendingRef = useRef({});
  const inflightRef = useRef(Promise.resolve());
  const canEdit = initial.role === 'owner' || initial.role === 'editor';
  const initialContent = useRef(initial.content || '<p></p>').current;

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent,
    editable: canEdit,
    editorProps: { attributes: { class: 'prose', 'aria-label': 'Isi dokumen' } },
    onUpdate: ({ editor: e }) => queueSave({ content: e.getHTML() }),
  });

  // Saves are serialized so each request carries the version returned by the previous one.
  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    const patch = pendingRef.current;
    pendingRef.current = {};
    if (Object.keys(patch).length === 0) return inflightRef.current;
    setStatus('saving');
    inflightRef.current = inflightRef.current.then(async () => {
      try {
        const saved = await api.updateDoc(docId, { ...patch, version: versionRef.current });
        versionRef.current = saved.version;
        setStatus((s) => (Object.keys(pendingRef.current).length ? 'dirty' : 'saved'));
      } catch (e) {
        if (e.status === 409) setStatus('conflict');
        else {
          setStatus('error');
          setError(e.message);
        }
      }
    });
    return inflightRef.current;
  }, [docId]);

  function queueSave(patch) {
    pendingRef.current = { ...pendingRef.current, ...patch };
    setStatus('dirty');
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(flush, SAVE_DELAY_MS);
  }

  // Flush pending changes when leaving / closing
  useEffect(() => {
    const beforeUnload = (e) => {
      if (Object.keys(pendingRef.current).length) {
        flush();
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', beforeUnload);
    return () => {
      window.removeEventListener('beforeunload', beforeUnload);
      flush();
    };
  }, [flush]);

  const commitTitle = () => {
    const t = title.trim();
    if (!doc || t === doc.title) return setTitle(doc?.title ?? '');
    if (!t) {
      setError('Judul tidak boleh kosong.');
      return setTitle(doc.title);
    }
    setError('');
    setDoc({ ...doc, title: t });
    setTitle(t);
    queueSave({ title: t });
    flush();
  };

  const statusText = {
    saved: 'Tersimpan',
    saving: 'Menyimpan…',
    dirty: 'Perubahan belum disimpan…',
    error: 'Gagal menyimpan',
    conflict: 'Konflik: dokumen diubah pengguna lain',
  }[status];

  return (
    <div className="editor-page">
      <div className="doc-head">
        <a href="#/" className="back" aria-label="Kembali ke daftar">←</a>
        <input
          className="title-input"
          value={title}
          readOnly={!canEdit}
          maxLength={120}
          aria-label="Judul dokumen"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <span className={`badge ${doc.role}`}>{ROLE_LABEL[doc.role]}</span>
        {canEdit && <span className={`save-status ${status}`} aria-live="polite">{statusText}</span>}
        {doc.role === 'owner' && <button className="btn primary" onClick={() => setShowShare(true)}>Bagikan</button>}
      </div>

      {doc.role !== 'owner' && (
        <div className="alert info">
          Dokumen milik <strong>{doc.owner.name}</strong>.{' '}
          {canEdit ? 'Anda dapat mengedit dokumen ini.' : 'Anda hanya dapat melihat dokumen ini.'}
        </div>
      )}
      {error && <div className="alert error" role="alert">{error}</div>}
      {status === 'conflict' && (
        <div className="alert error" role="alert">
          Dokumen telah diubah oleh pengguna lain. <button className="btn" onClick={() => window.location.reload()}>Muat ulang</button>
        </div>
      )}

      {canEdit && editor && <Toolbar editor={editor} />}
      <div className={`paper ${canEdit ? '' : 'readonly'}`}>
        <EditorContent editor={editor} />
      </div>

      {showShare && (
        <ShareDialog
          doc={doc}
          onClose={() => setShowShare(false)}
          onChange={(shares) => setDoc((d) => ({ ...d, shares }))}
        />
      )}
    </div>
  );
}
