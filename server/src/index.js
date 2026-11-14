import path from 'node:path';
import { createApp, defaultClientDir } from './app.js';

const port = Number(process.env.PORT) || 3001;
const dbFile = process.env.DB_FILE || path.resolve('data/ajaia.db');
const app = createApp({ dbFile, clientDir: process.env.CLIENT_DIR || defaultClientDir });

app.listen(port, () => console.log(`Ajaia Docs listening on http://localhost:${port} (db: ${dbFile})`));
