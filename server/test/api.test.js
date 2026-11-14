import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/app.js';

let server;
let base;

before(async () => {
  const app = createApp({ dbFile: ':memory:' });
  await new Promise((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://localhost:${server.address().port}/api`;
});

after(() => server.close());

const ALICE = 1;
const BOB = 2;
const CAROL = 3;

async function call(method, url, { user, body, form } = {}) {
  const headers = {};
  if (user) headers['x-user-id'] = String(user);
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(base + url, { method, headers, body: payload });
  const text = await res.text();
  return { status: res.status, json: text ? JSON.parse(text) : null };
}

test('requires a user for document endpoints', async () => {
  const r = await call('GET', '/docs');
  assert.equal(r.status, 401);
});

test('create, rename, edit, and reopen a document', async () => {
  const created = await call('POST', '/docs', { user: ALICE, body: { title: 'Rencana' } });
  assert.equal(created.status, 201);
  const id = created.json.id;

  const edit = await call('PATCH', `/docs/${id}`, {
    user: ALICE,
    body: { title: 'Rencana Q1', content: '<h1>Hai</h1><p><strong>tebal</strong> <em>miring</em> <u>garis</u></p><ul><li>a</li></ul>' },
  });
  assert.equal(edit.status, 200);
  assert.equal(edit.json.title, 'Rencana Q1');

  const reopened = await call('GET', `/docs/${id}`, { user: ALICE });
  assert.equal(reopened.json.title, 'Rencana Q1');
  assert.match(reopened.json.content, /<strong>tebal<\/strong>/);
  assert.match(reopened.json.content, /<ul><li>a<\/li><\/ul>/);
  assert.equal(reopened.json.role, 'owner');
});

test('validation: empty title and non-string content are rejected', async () => {
  const bad = await call('POST', '/docs', { user: ALICE, body: { title: '   ' } });
  assert.equal(bad.status, 400);
  const { json: doc } = await call('POST', '/docs', { user: ALICE, body: {} });
  const bad2 = await call('PATCH', `/docs/${doc.id}`, { user: ALICE, body: { content: 123 } });
  assert.equal(bad2.status, 400);
});

test('content is sanitized (no scripts or event handlers)', async () => {
  const { json: doc } = await call('POST', '/docs', { user: ALICE, body: {} });
  await call('PATCH', `/docs/${doc.id}`, {
    user: ALICE,
    body: { content: '<p onclick="x()">hi</p><script>alert(1)</script>' },
  });
  const got = await call('GET', `/docs/${doc.id}`, { user: ALICE });
  assert.equal(got.json.content, '<p>hi</p>');
});

test('sharing: strangers cannot see; viewer reads but cannot write; editor can write; only owner manages shares', async () => {
  const { json: doc } = await call('POST', '/docs', { user: ALICE, body: { title: 'Rahasia' } });

  // stranger gets 404 (does not leak existence)
  assert.equal((await call('GET', `/docs/${doc.id}`, { user: BOB })).status, 404);

  // owner shares: Bob editor, Carol viewer
  assert.equal((await call('POST', `/docs/${doc.id}/shares`, { user: ALICE, body: { email: 'bob@example.com', role: 'editor' } })).status, 201);
  assert.equal((await call('POST', `/docs/${doc.id}/shares`, { user: ALICE, body: { email: 'carol@example.com', role: 'viewer' } })).status, 201);

  // listing separates owned vs shared
  const bobList = await call('GET', '/docs', { user: BOB });
  assert.ok(bobList.json.shared.some((d) => d.id === doc.id && d.role === 'editor'));
  assert.ok(!bobList.json.owned.some((d) => d.id === doc.id));

  // viewer: read ok, write forbidden
  assert.equal((await call('GET', `/docs/${doc.id}`, { user: CAROL })).json.role, 'viewer');
  assert.equal((await call('PATCH', `/docs/${doc.id}`, { user: CAROL, body: { title: 'x' } })).status, 403);

  // editor: write ok, but cannot share or delete
  assert.equal((await call('PATCH', `/docs/${doc.id}`, { user: BOB, body: { title: 'Diubah Bob' } })).status, 200);
  assert.equal((await call('POST', `/docs/${doc.id}/shares`, { user: BOB, body: { email: 'carol@example.com', role: 'editor' } })).status, 403);
  assert.equal((await call('DELETE', `/docs/${doc.id}`, { user: BOB })).status, 403);

  // revoke access
  assert.equal((await call('DELETE', `/docs/${doc.id}/shares/${BOB}`, { user: ALICE })).status, 204);
  assert.equal((await call('GET', `/docs/${doc.id}`, { user: BOB })).status, 404);
});

test('share validation: unknown email, bad role, sharing with owner', async () => {
  const { json: doc } = await call('POST', '/docs', { user: ALICE, body: {} });
  assert.equal((await call('POST', `/docs/${doc.id}/shares`, { user: ALICE, body: { email: 'nobody@x.com', role: 'viewer' } })).status, 404);
  assert.equal((await call('POST', `/docs/${doc.id}/shares`, { user: ALICE, body: { email: 'bob@example.com', role: 'admin' } })).status, 400);
  assert.equal((await call('POST', `/docs/${doc.id}/shares`, { user: ALICE, body: { email: 'alice@example.com', role: 'viewer' } })).status, 400);
});

test('stale version edit returns 409', async () => {
  const { json: doc } = await call('POST', '/docs', { user: ALICE, body: {} });
  const ok = await call('PATCH', `/docs/${doc.id}`, { user: ALICE, body: { title: 'v2', version: doc.version } });
  assert.equal(ok.status, 200);
  const stale = await call('PATCH', `/docs/${doc.id}`, { user: ALICE, body: { title: 'v3', version: doc.version } });
  assert.equal(stale.status, 409);
});

function fileForm(name, content) {
  const form = new FormData();
  form.append('file', new Blob([content]), name);
  return form;
}

test('upload: .md and .txt become editable documents', async () => {
  const md = await call('POST', '/docs/import', { user: ALICE, form: fileForm('catatan.md', '# Judul\n\nIsi **tebal**\n\n- satu\n- dua') });
  assert.equal(md.status, 201);
  assert.equal(md.json.title, 'catatan');
  assert.match(md.json.content, /<h1>Judul<\/h1>/);
  assert.match(md.json.content, /<strong>tebal<\/strong>/);
  assert.match(md.json.content, /<li>satu<\/li>/);

  const txt = await call('POST', '/docs/import', { user: ALICE, form: fileForm('a.txt', 'Baris 1\n\nParagraf <b>2</b>') });
  assert.equal(txt.status, 201);
  assert.match(txt.json.content, /<p>Baris 1<\/p><p>Paragraf &lt;b&gt;2&lt;\/b&gt;<\/p>/);
});

test('upload: unsupported type, empty file and missing file are rejected', async () => {
  const exe = await call('POST', '/docs/import', { user: ALICE, form: fileForm('virus.exe', 'abc') });
  assert.equal(exe.status, 400);
  assert.match(exe.json.error, /tidak didukung/);
  const empty = await call('POST', '/docs/import', { user: ALICE, form: fileForm('kosong.txt', '') });
  assert.equal(empty.status, 400);
  const none = await call('POST', '/docs/import', { user: ALICE, form: new FormData() });
  assert.equal(none.status, 400);
});

test('upload: oversized file is rejected', async () => {
  const big = 'a'.repeat(2 * 1024 * 1024 + 10);
  const r = await call('POST', '/docs/import', { user: ALICE, form: fileForm('besar.txt', big) });
  assert.equal(r.status, 400);
  assert.match(r.json.error, /terlalu besar/);
});

test('seed data: Alice owns a sample doc shared with Bob and Carol', async () => {
  const aliceList = await call('GET', '/docs', { user: ALICE });
  const sample = aliceList.json.owned.find((d) => d.title.startsWith('Dokumen Contoh'));
  assert.ok(sample);
  assert.equal(sample.shareCount, 2);
});

test('upload: .docx is converted with headings, bold and lists preserved', async () => {
  const { readFile } = await import('node:fs/promises');
  const buf = await readFile(new URL('./fixtures/sample.docx', import.meta.url));
  const r = await call('POST', '/docs/import', { user: ALICE, form: fileForm('sample.docx', buf) });
  assert.equal(r.status, 201);
  assert.match(r.json.content, /<h1>Judul DOCX<\/h1>/);
  assert.match(r.json.content, /<strong>tebal<\/strong>/);
  assert.match(r.json.content, /<ul><li>butir satu<\/li><\/ul>/);
});
