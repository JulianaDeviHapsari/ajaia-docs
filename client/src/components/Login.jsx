import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Login({ onLogin }) {
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api.users().then(setUsers).catch((e) => setError(e.message));
  }, []);

  const hints = {
    1: 'Pemilik dokumen contoh',
    2: 'Editor pada dokumen contoh',
    3: 'Viewer (hanya baca) pada dokumen contoh',
  };

  return (
    <div className="login">
      <h1>Ajaia Docs</h1>
      <p className="muted">Pilih akun demo untuk masuk. Tidak perlu kata sandi (autentikasi simulasi).</p>
      {error && <div className="alert error">{error}</div>}
      <div className="user-list">
        {users.map((u) => (
          <button key={u.id} className="user-card" onClick={() => onLogin(u)}>
            <strong>{u.name}</strong>
            <span>{u.email}</span>
            <small>{hints[u.id]}</small>
          </button>
        ))}
      </div>
    </div>
  );
}
