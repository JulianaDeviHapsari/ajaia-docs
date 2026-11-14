import { useEffect, useRef, useState } from 'react';
import { api, SUPPORTED_FILES, MAX_UPLOAD_MB } from '../api.js';
import { go } from '../App.jsx';

const fmt = (s) => new Date(s.replace(' ', 'T') + 'Z').toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });

export default function DocList({ user }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const load = () =>
    api.listDocs().then(setData).catch((e) => setError(e.message));

  useEffect(() => {
    load();
  }, [user.id]);

  const create = async () => {
    setBusy(true);
    try {
      const doc = await api.createDoc();
      go(`#/doc/${doc.id}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError('');
    const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    if (!SUPPORTED_FILES.includes(ext)) {
      return setError(`Tipe file ${ext} tidak didukung. Gunakan: ${SUPPORTED_FILES.join(', ')}`);
    }
    if (file.size > MAX_UPLOAD_MB * 1024 * 1024) {
      return setError(`File terlalu besar (maks ${MAX_UPLOAD_MB} MB).`);
    }
    setBusy(true);
    try {
      const doc = await api.importFile(file);
      go(`#/doc/${doc.id}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (doc) => {
    if (!window.confirm(`Hapus "${doc.title}" secara permanen?`)) return;
    try {
      await api.deleteDoc(doc.id);
      load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page">
      <div className="page-head">
        <h2>Dokumen</h2>
        <div className="actions">
          <button className="btn primary" onClick={create} disabled={busy}>+ Dokumen baru</button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={busy}>Unggah file</button>
          <input ref={fileRef} type="file" accept={SUPPORTED_FILES.join(',')} hidden onChange={onFile} />
        </div>
      </div>
      <p className="muted small">
        Unggah mendukung {SUPPORTED_FILES.join(', ')} (maks {MAX_UPLOAD_MB} MB) dan mengubahnya menjadi dokumen baru yang dapat diedit.
      </p>
      {error && <div className="alert error" role="alert">{error}</div>}

      {!data ? (
        <p className="muted">Memuat…</p>
      ) : (
        <>
          <section>
            <h3>Dokumen saya <span className="count">{data.owned.length}</span></h3>
            {data.owned.length === 0 && <p className="empty">Belum ada dokumen. Buat atau unggah satu.</p>}
            <ul className="doc-list">
              {data.owned.map((d) => (
                <li key={d.id}>
                  <a href={`#/doc/${d.id}`} className="doc-link">
                    <span className="doc-title">{d.title}</span>
                    <span className="meta">
                      Diubah {fmt(d.updatedAt)}
                      {d.shareCount > 0 && <span className="badge shared">Dibagikan ke {d.shareCount}</span>}
                      {d.shareCount === 0 && <span className="badge private">Pribadi</span>}
                    </span>
                  </a>
                  <button className="btn ghost danger" onClick={() => remove(d)} aria-label={`Hapus ${d.title}`}>Hapus</button>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3>Dibagikan kepada saya <span className="count">{data.shared.length}</span></h3>
            {data.shared.length === 0 && <p className="empty">Belum ada dokumen yang dibagikan kepada Anda.</p>}
            <ul className="doc-list">
              {data.shared.map((d) => (
                <li key={d.id}>
                  <a href={`#/doc/${d.id}`} className="doc-link">
                    <span className="doc-title">{d.title}</span>
                    <span className="meta">
                      Milik {d.ownerName} · Diubah {fmt(d.updatedAt)}
                      <span className={`badge ${d.role}`}>{d.role === 'editor' ? 'Bisa mengedit' : 'Hanya lihat'}</span>
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
