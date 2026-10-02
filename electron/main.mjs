// Electron main process: starts the local Vite server as a child process,
// shows a splash while it warms up, then points a window at it.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  app,
  BrowserWindow,
  dialog,
  nativeImage,
  session,
  shell,
} from 'electron';
import {
  APP_NAME,
  findFreePort,
  iconPathFor,
  isAppUrl,
  isExternalWebUrl,
  parsePort,
  parseReadyUrl,
  serverEnv,
  shouldGrantPermission,
  splashUrl,
  windowOptions,
} from './lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(HERE, 'assets');
const SERVER_TIMEOUT_MS = 120_000;

app.setName(APP_NAME);
let server = null;
let quitting = false;

async function startServer() {
  const port =
    parsePort(process.env.GEV_ELECTRON_PORT) ?? (await findFreePort());
  return new Promise((resolve, reject) => {
    server = spawn(process.execPath, [path.join(HERE, 'server.mjs')], {
      cwd: path.resolve(HERE, '..'),
      env: serverEnv(process.env, port),
      stdio: ['ignore', 'pipe', 'pipe', 'ipc'],
    });
    const timer = setTimeout(
      () =>
        reject(
          new Error(
            `Vite took longer than ${SERVER_TIMEOUT_MS / 1000}s to wake up.`,
          ),
        ),
      SERVER_TIMEOUT_MS,
    );
    let tail = '';
    server.stdout.on('data', (chunk) => {
      process.stdout.write(chunk);
      tail = (tail + chunk).slice(-4096);
      const url = parseReadyUrl(tail);
      if (url) {
        clearTimeout(timer);
        resolve(url);
      }
    });
    server.stderr.on('data', (chunk) => {
      process.stderr.write(chunk);
      tail = (tail + chunk).slice(-4096);
    });
    server.once('exit', (code) => {
      clearTimeout(timer);
      if (quitting) return;
      const message = `Local server exited (code ${code}).\n\n${tail.trim().slice(-1500)}`;
      reject(new Error(message));
      if (BrowserWindow.getAllWindows().length) {
        dialog.showErrorBox(APP_NAME, message);
        app.quit();
      }
    });
  });
}

function stopServer() {
  quitting = true;
  if (server && server.exitCode === null) server.kill('SIGTERM');
}

function hardenSession(appUrl) {
  session.defaultSession.setPermissionRequestHandler(
    (contents, permission, callback) => {
      callback(shouldGrantPermission(permission, contents.getURL(), appUrl));
    },
  );
  session.defaultSession.setPermissionCheckHandler(
    (_contents, permission, origin) =>
      shouldGrantPermission(permission, origin, appUrl),
  );
}

function wireNavigation(win, appUrl) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isExternalWebUrl(url, appUrl)) shell.openExternal(url);
    // Same-origin popups (e.g. CCTV pop-outs) get a normal child window.
    return isAppUrl(url, appUrl) ? { action: 'allow' } : { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (isAppUrl(url, appUrl)) return;
    event.preventDefault();
    if (isExternalWebUrl(url, appUrl)) shell.openExternal(url);
  });
}

async function createWindow() {
  const iconPath = iconPathFor(ASSETS);
  if (process.platform === 'darwin') {
    app.dock?.setIcon(
      nativeImage.createFromPath(path.join(ASSETS, 'icon.png')),
    );
  }
  const win = new BrowserWindow(windowOptions({ iconPath }));
  win.once('ready-to-show', () => win.show());
  await win.loadURL(splashUrl());

  const appUrl = await startServer();
  hardenSession(appUrl);
  wireNavigation(win, appUrl);
  await win.loadURL(appUrl);
}

app.whenReady().then(() =>
  createWindow().catch((error) => {
    dialog.showErrorBox(APP_NAME, `Could not start: ${error.message}`);
    stopServer();
    app.quit();
  }),
);

// One window, one server: closing the window ends the show, even on macOS.
app.on('window-all-closed', () => app.quit());
app.on('before-quit', stopServer);
