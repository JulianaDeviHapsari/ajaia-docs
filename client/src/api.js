const KEY = 'ajaia.userId';

export const session = {
  get: () => localStorage.getItem(KEY),
  set: (id) => localStorage.setItem(KEY, String(id)),
  clear: () => localStorage.removeItem(KEY),
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

async function request(method, url, { body, form } = {}) {
  const headers = {};
  const uid = session.get();
  if (uid) headers['x-user-id'] = uid;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  let res;
  try {
    res = await fetch('/api' + url, { method, headers, body: payload });
  } catch {
    throw new ApiError(0, 'Tidak dapat terhubung ke server.');
  }
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Terjadi kesalahan.');
  return data;
}

export const api = {
  users: () => request('GET', '/users'),
  listDocs: () => request('GET', '/docs'),
  getDoc: (id) => request('GET', `/docs/${id}`),
  createDoc: (body = {}) => request('POST', '/docs', { body }),
  updateDoc: (id, body) => request('PATCH', `/docs/${id}`, { body }),
  deleteDoc: (id) => request('DELETE', `/docs/${id}`),
  importFile: (file) => {
    const form = new FormData();
    form.append('file', file);
    return request('POST', '/docs/import', { form });
  },
  share: (id, email, role) => request('POST', `/docs/${id}/shares`, { body: { email, role } }),
  unshare: (id, userId) => request('DELETE', `/docs/${id}/shares/${userId}`),
};

export const SUPPORTED_FILES = ['.txt', '.md', '.docx'];
export const MAX_UPLOAD_MB = 2;
