import { useEffect, useState } from 'react';
import { api, session } from './api.js';
import Login from './components/Login.jsx';
import DocList from './components/DocList.jsx';
import Editor from './components/Editor.jsx';

function useHashRoute() {
  const read = () => {
    const m = window.location.hash.match(/^#\/doc\/(\d+)$/);
    return m ? { name: 'doc', id: Number(m[1]) } : { name: 'home' };
  };
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => setRoute(read());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export const go = (path) => {
  window.location.hash = path;
};

export default function App() {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const route = useHashRoute();

  // Restore the simulated session from localStorage.
  useEffect(() => {
    const id = Number(session.get());
    if (!id) return setReady(true);
    api
      .users()
      .then((users) => setUser(users.find((u) => u.id === id) ?? null))
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const logout = () => {
    session.clear();
    setUser(null);
    go('#/');
  };

  if (!ready) return <div className="center muted">Memuat…</div>;
  if (!user) return <Login onLogin={(u) => { session.set(u.id); setUser(u); }} />;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/">Ajaia Docs</a>
        <div className="topbar-right">
          <span className="who" title={user.email}>{user.name}</span>
          <button className="btn ghost" onClick={logout}>Ganti pengguna</button>
        </div>
      </header>
      <main>
        {route.name === 'doc' ? <Editor key={route.id} docId={route.id} user={user} /> : <DocList user={user} />}
      </main>
    </div>
  );
}
