import { useState } from 'react';
import { api } from '../api.js';

export default function ShareDialog({ doc, onClose, onChange }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const shares = doc.shares ?? [];

  const upsert = (entry) => {
    const next = [...shares.filter((s) => s.userId !== entry.userId), entry].sort((a, b) => a.name.localeCompare(b.name));
    onChange(next);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!/^\S+@\S+\.\S+$/.test(email.trim())) return setError('Masukkan alamat email yang valid.');
    setBusy(true);
    try {
      upsert(await api.share(doc.id, email.trim(), role));
      setEmail('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (s, newRole) => {
    setError('');
    try {
      upsert(await api.share(doc.id, s.email, newRole));
    } catch (err) {
      setError(err.message);
    }
  };

  const revoke = async (s) => {
    setError('');
    try {
      await api.unshare(doc.id, s.userId);
      onChange(shares.filter((x) => x.userId !== s.userId));
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label="Bagikan dokumen">
        <div className="modal-head">
          <h3>Bagikan “{doc.title}”</h3>
          <button className="btn ghost" onClick={onClose} aria-label="Tutup">✕</button>
        </div>

        <form className="share-form" onSubmit={submit}>
          <input
            type="email"
            placeholder="Email pengguna (mis. bob@example.com)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Email pengguna"
            list="demo-users"
          />
          <datalist id="demo-users">
            <option value="bob@example.com" />
            <option value="carol@example.com" />
          </datalist>
          <select value={role} onChange={(e) => setRole(e.target.value)} aria-label="Peran">
            <option value="viewer">Hanya lihat</option>
            <option value="editor">Bisa mengedit</option>
          </select>
          <button className="btn primary" disabled={busy}>Bagikan</button>
        </form>
        {error && <div className="alert error" role="alert">{error}</div>}

        <h4>Orang dengan akses</h4>
        <ul className="share-list">
          <li>
            <div><strong>{doc.owner.name}</strong><div className="muted small">{doc.owner.email}</div></div>
            <span className="badge owner">Pemilik</span>
          </li>
          {shares.map((s) => (
            <li key={s.userId}>
              <div><strong>{s.name}</strong><div className="muted small">{s.email}</div></div>
              <div className="share-actions">
                <select value={s.role} onChange={(e) => changeRole(s, e.target.value)} aria-label={`Peran ${s.name}`}>
                  <option value="viewer">Hanya lihat</option>
                  <option value="editor">Bisa mengedit</option>
                </select>
                <button className="btn ghost danger" onClick={() => revoke(s)}>Hapus akses</button>
              </div>
            </li>
          ))}
          {shares.length === 0 && <li className="muted">Dokumen ini masih pribadi.</li>}
        </ul>
      </div>
    </div>
  );
}
