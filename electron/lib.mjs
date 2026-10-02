// Pure helpers for the Electron shell. Nothing in here imports `electron`,
// so the tests can run under plain `node --test` without summoning Chromium.
import net from 'node:net';
import path from 'node:path';

export const APP_NAME = "God's Eye View";
export const READY_PREFIX = '[GEV-Electron] Ready at';
const READY_PATTERN =
  /\[GEV-Electron\] Ready at (http:\/\/127\.0\.0\.1:\d{1,5}\/)/;

/** Permissions the console legitimately needs: the mic for voice, the rest for comfort. */
export const GRANTED_PERMISSIONS = Object.freeze([
  'media',
  'geolocation',
  'fullscreen',
  'pointerLock',
  'clipboard-sanitized-write',
]);

/** Format the line the server child prints once Vite is listening. */
export function formatReadyLine(url) {
  return `${READY_PREFIX} ${url}`;
}

/** Fish the app URL out of a chunk of server stdout, or return null. */
export function parseReadyUrl(chunk) {
  const match = READY_PATTERN.exec(String(chunk ?? ''));
  return match ? match[1] : null;
}

/** Ask the OS for a free localhost port by briefly squatting on port 0. */
export function findFreePort(host = '127.0.0.1') {
  return new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.unref();
    probe.once('error', reject);
    probe.listen(0, host, () => {
      const { port } = probe.address();
      probe.close(() => resolve(port));
    });
  });
}

/** Parse an explicit GEV_ELECTRON_PORT, or null to let findFreePort decide. */
export function parsePort(value) {
  if (value === undefined || value === null || value === '') return null;
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(
      `GEV_ELECTRON_PORT must be 1-65535, got "${value}". Nice try.`,
    );
  }
  return port;
}

function originOf(url) {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** True when `target` lives on the local app server (same origin). */
export function isAppUrl(target, appUrl) {
  const origin = originOf(target);
  return origin !== null && origin === originOf(appUrl);
}

/** http(s) links leaving the app belong in the user's real browser. */
export function isExternalWebUrl(target, appUrl) {
  if (isAppUrl(target, appUrl)) return false;
  try {
    return ['http:', 'https:'].includes(new URL(target).protocol);
  } catch {
    return false;
  }
}

/** Grant only allow-listed permissions, and only to the app's own origin. */
export function shouldGrantPermission(permission, requestingUrl, appUrl) {
  return (
    GRANTED_PERMISSIONS.includes(permission) && isAppUrl(requestingUrl, appUrl)
  );
}

/** Env for the server child: Electron's binary moonlighting as plain Node. */
export function serverEnv(baseEnv, port) {
  return {
    ...baseEnv,
    ELECTRON_RUN_AS_NODE: '1',
    GEV_ELECTRON_PORT: String(port),
  };
}

/** BrowserWindow options. contextIsolation and sandbox stay on: it's a globe, not a backdoor. */
export function windowOptions({ iconPath, platform = process.platform } = {}) {
  return {
    width: 1600,
    height: 1000,
    minWidth: 960,
    minHeight: 600,
    title: APP_NAME,
    backgroundColor: '#050a14',
    show: false,
    ...(platform === 'linux' && iconPath ? { icon: iconPath } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  };
}

/** The best icon for the platform; macOS takes .icns, everybody else gets a PNG. */
export function iconPathFor(assetsDir, platform = process.platform) {
  return path.join(assetsDir, platform === 'darwin' ? 'icon.icns' : 'icon.png');
}

const QUIPS = [
  'Calibrating the all-seeing eye…',
  'Untangling satellite orbits…',
  'Asking aircraft politely where they are…',
  'Polishing the photorealistic tiles…',
  'Counting ships. Please do not move.',
];

/** A loading quip. Deterministic when you pass a seed, so tests stay boring. */
export function loadingQuip(seed = Math.random()) {
  const index = Math.floor(Math.abs(seed) * QUIPS.length) % QUIPS.length;
  return QUIPS[index];
}

/** Tiny dark splash shown while Vite warms up (first run can take a moment). */
export function splashHtml(quip = loadingQuip()) {
  const safe = String(quip).replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  return `<!doctype html><html><head><meta charset="utf-8"><title>${APP_NAME}</title>
<style>
  html,body{margin:0;height:100%;background:#050a14;color:#00f6ff;
    font:14px ui-monospace,SFMono-Regular,Menlo,monospace;display:grid;place-items:center}
  .eye{width:72px;height:72px;border:3px solid #48b;border-radius:50%;
    border-top-color:#00f6ff;animation:spin 1.1s linear infinite;margin:0 auto 20px}
  @keyframes spin{to{transform:rotate(360deg)}}
  p{opacity:.8;letter-spacing:.04em}
</style></head><body><div><div class="eye"></div><p>${safe}</p></div></body></html>`;
}

/** Data URL wrapper so the splash needs no file on disk. */
export function splashUrl(quip) {
  return `data:text/html;charset=utf-8,${encodeURIComponent(splashHtml(quip))}`;
}
