// Server child for the Electron shell. Runs under ELECTRON_RUN_AS_NODE, i.e.
// Electron's own Node 24, and boots the same Vite dev server as `npm run dev`
// so every local provider proxy keeps working. Modeled on scripts/pinokio-start.mjs.
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findFreePort, formatReadyLine, parsePort } from './lib.mjs';

const ROOT = realpathSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'),
);

async function start() {
  const port =
    parsePort(process.env.GEV_ELECTRON_PORT) ?? (await findFreePort());
  process.chdir(ROOT);
  // Imported late: Vite snapshots process.env while configuring.
  const { createServer } = await import('vite');
  const server = await createServer({
    root: ROOT,
    server: { host: '127.0.0.1', port, strictPort: true, open: false },
  });
  await server.listen();
  console.log(formatReadyLine(`http://127.0.0.1:${port}/`));

  const shutdown = async () => {
    await server.close();
    process.exit(0);
  };
  process.once('SIGINT', shutdown);
  process.once('SIGTERM', shutdown);
  // If the Electron parent dies without saying goodbye, don't haunt the port.
  process.on('disconnect', shutdown);
}

start().catch((error) => {
  console.error(`[GEV-Electron] Server refused to start: ${error.message}`);
  process.exitCode = 1;
});
