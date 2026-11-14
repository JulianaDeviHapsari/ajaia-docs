import { chromium } from 'playwright-core';
const BASE = process.env.BASE_URL || 'http://localhost:3055';
const OUT = process.argv[2];
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
const log = (m) => console.log('✔', m);
const fail = (m) => { console.error('✘', m); process.exitCode = 1; };

async function login(page, name) {
  await page.goto(BASE);
  await page.evaluate(() => localStorage.clear());
  await page.goto(BASE);
  await page.getByRole('button', { name: new RegExp(name) }).click();
  await page.getByText('Dokumen saya').waitFor();
}

// --- Alice: create, rename, format, persist ---
const ctxA = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const a = await ctxA.newPage();
const errors = []; a.on('pageerror', (e) => errors.push(e.message)); a.on('console', (m) => m.type()==='error' && errors.push(m.text()));
await login(a, 'Alice');
await a.screenshot({ path: `${OUT}/01-doc-list.png` });
await a.getByRole('button', { name: '+ Dokumen baru' }).click();
await a.locator('.prose').waitFor();
await a.getByLabel('Judul dokumen').fill('Rencana E2E');
await a.getByLabel('Judul dokumen').press('Enter');
await a.locator('.prose').click();
await a.selectOption('select[aria-label="Gaya teks"]', 'h1');
await a.keyboard.type('Judul Besar');
await a.keyboard.press('Enter');
await a.getByLabel('Tebal').click(); await a.keyboard.type('tebal '); await a.getByLabel('Tebal').click();
await a.getByLabel('Miring').click(); await a.keyboard.type('miring '); await a.getByLabel('Miring').click();
await a.getByLabel('Garis bawah').click(); await a.keyboard.type('garis'); await a.getByLabel('Garis bawah').click();
await a.keyboard.press('Enter');
await a.getByLabel('Daftar berpoin').click(); await a.keyboard.type('poin satu'); await a.keyboard.press('Enter'); await a.keyboard.type('poin dua');
await a.getByText('Tersimpan').waitFor({ timeout: 5000 });
await a.screenshot({ path: `${OUT}/02-editor.png` });
log('Alice: created, renamed, formatted, autosaved');
const docUrl = a.url();

await a.reload();
await a.locator('.prose h1').waitFor();
const html = await a.locator('.prose').innerHTML();
for (const [re, label] of [[/<h1>Judul Besar<\/h1>/, 'h1'], [/<strong>tebal /, 'bold'], [/<em>miring /, 'italic'], [/<u>garis<\/u>/, 'underline'], [/<ul>.*poin satu.*poin dua/s, 'bullets']]) {
  re.test(html) ? log(`persisted after reload: ${label}`) : fail(`missing after reload: ${label}\n${html}`);
}
(await a.getByLabel('Judul dokumen').inputValue()) === 'Rencana E2E' ? log('persisted title') : fail('title not persisted');

// --- Share with Carol (viewer) and Bob (editor) ---
await a.getByRole('button', { name: 'Bagikan', exact: true }).click();
await a.getByLabel('Email pengguna').fill('carol@example.com');
await a.getByLabel('Peran', { exact: true }).selectOption('viewer');
await a.locator('.share-form').getByRole('button', { name: 'Bagikan' }).click();
await a.getByLabel('Email pengguna').fill('bob@example.com');
await a.getByLabel('Peran', { exact: true }).selectOption('editor');
await a.locator('.share-form').getByRole('button', { name: 'Bagikan' }).click();
await a.getByLabel('Peran Carol Viewer').waitFor();
await a.getByLabel('Peran Bob Editor').waitFor();
await a.screenshot({ path: `${OUT}/03-share-dialog.png` });
log('Alice: shared with Carol (viewer) and Bob (editor)');

// --- Carol: read-only ---
const ctxC = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const c = await ctxC.newPage();
await login(c, 'Carol');
await c.getByText('Rencana E2E').click();
await c.locator('.prose h1').waitFor();
const editable = await c.locator('.prose').getAttribute('contenteditable');
const hasToolbar = await c.locator('.toolbar').count();
editable === 'false' && hasToolbar === 0 ? log('Carol (viewer): read-only, no toolbar') : fail(`Carol can edit? contenteditable=${editable} toolbar=${hasToolbar}`);
await c.screenshot({ path: `${OUT}/04-viewer.png` });

// --- Bob: can edit, edit visible to Alice ---
const ctxB = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const b = await ctxB.newPage();
await login(b, 'Bob');
await b.getByText('Rencana E2E').click();
await b.locator('.prose h1').waitFor();
await b.locator('.prose').click(); await b.keyboard.press('Control+End'); await b.keyboard.type(' tambahan Bob');
await b.getByText('Tersimpan').waitFor({ timeout: 5000 });
await a.reload(); await a.locator('.prose h1').waitFor();
(await a.locator('.prose').innerText()).includes('tambahan Bob') ? log("Bob's edit is visible to Alice") : fail("Bob's edit missing");

// --- Bob should not see "Bagikan" ---
(await b.getByRole('button', { name: 'Bagikan', exact: true }).count()) === 0 ? log('Bob (editor): no share button') : fail('Bob sees share');

// --- Upload .md ---
await a.goto(BASE + '/#/');
await a.getByText('Dokumen saya').waitFor();
await a.locator('input[type=file]').setInputFiles({ name: 'catatan.md', mimeType: 'text/markdown', buffer: Buffer.from('# Dari Markdown\n\nIsi **tebal**\n\n1. satu\n2. dua') });
await a.locator('.prose h1').waitFor();
(await a.locator('.prose h1').innerText()) === 'Dari Markdown' ? log('Upload .md → editable doc') : fail('md import');
await a.goto(BASE + '/#/');
await a.locator('input[type=file]').setInputFiles({ name: 'bad.exe', mimeType: 'application/octet-stream', buffer: Buffer.from('x') });
await a.getByText(/tidak didukung/).waitFor();
log('Upload unsupported type shows clear error');

// --- Owner list separation ---
await a.screenshot({ path: `${OUT}/05-upload-error.png` });
errors.length ? fail('console errors: ' + errors.join(' | ')) : log('no console errors');
await browser.close();
