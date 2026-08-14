import { config } from './config.js';
import './db/database.js';
import { createServer } from './http/server.js';
import { runScanner, stopScanner } from './workers/blockScanner.js';

const app = createServer();
const server = app.listen(config.PORT, config.HOST, () => console.log(`[api] http://${config.HOST}:${config.PORT}`));
void runScanner();

for (const signal of ['SIGINT','SIGTERM'] as const) process.on(signal, () => {
  stopScanner(); server.close(() => process.exit(0));
});
