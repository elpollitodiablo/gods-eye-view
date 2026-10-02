import assert from 'node:assert/strict';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';
import {
  APP_NAME,
  findFreePort,
  formatReadyLine,
  GRANTED_PERMISSIONS,
  iconPathFor,
  isAppUrl,
  isExternalWebUrl,
  loadingQuip,
  parsePort,
  parseReadyUrl,
  serverEnv,
  shouldGrantPermission,
  splashHtml,
  splashUrl,
  windowOptions,
} from './lib.mjs';

const APP = 'http://127.0.0.1:41234/';

test('ready line round-trips through the parser', () => {
  assert.equal(parseReadyUrl(formatReadyLine(APP)), APP);
});

test('ready line is found even when Vite is chatty around it', () => {
  const noisy = `  VITE v6 ready\n  ➜  Local: ${APP}\n${formatReadyLine(APP)}\nmore noise`;
  assert.equal(parseReadyUrl(noisy), APP);
});

test('parser ignores impostors that are not on loopback', () => {
  assert.equal(
    parseReadyUrl('[GEV-Electron] Ready at http://evil.example:80/'),
    null,
  );
  assert.equal(parseReadyUrl('Ready at http://127.0.0.1:1234/'), null);
  assert.equal(parseReadyUrl(undefined), null);
});

test('findFreePort hands back a port we can actually bind', async () => {
  const port = await findFreePort();
  assert.ok(port > 0 && port <= 65535);
  await new Promise((resolve, reject) => {
    const s = net.createServer().once('error', reject);
    s.listen(port, '127.0.0.1', () => s.close(resolve));
  });
});

test('parsePort accepts sane ports and treats blanks as "you pick"', () => {
  assert.equal(parsePort('4173'), 4173);
  assert.equal(parsePort(''), null);
  assert.equal(parsePort(undefined), null);
});

test('parsePort rejects ports from the land of make-believe', () => {
  for (const bad of ['0', '65536', 'eleventy', '41.5', '-1']) {
    assert.throws(() => parsePort(bad), /GEV_ELECTRON_PORT/, bad);
  }
});

test('isAppUrl matches by origin, not by vibes', () => {
  assert.ok(isAppUrl('http://127.0.0.1:41234/some/deep/path?x=1', APP));
  assert.ok(!isAppUrl('http://127.0.0.1:9999/', APP));
  assert.ok(!isAppUrl('http://localhost:41234/', APP));
  assert.ok(!isAppUrl('not a url', APP));
});

test('external http(s) links go to the system browser, other schemes go nowhere', () => {
  assert.ok(
    isExternalWebUrl('https://github.com/bilawalsidhu/gods-eye-view', APP),
  );
  assert.ok(isExternalWebUrl('http://example.com', APP));
  assert.ok(!isExternalWebUrl(`${APP}#flights`, APP));
  assert.ok(!isExternalWebUrl('file:///etc/passwd', APP));
  assert.ok(!isExternalWebUrl('javascript:alert(1)', APP));
});

test('the microphone is granted to the app and nobody else', () => {
  assert.ok(shouldGrantPermission('media', APP, APP));
  assert.ok(!shouldGrantPermission('media', 'https://sketchy.example/', APP));
});

test('permissions outside the allow-list are politely declined', () => {
  assert.ok(!shouldGrantPermission('notifications', APP, APP));
  assert.ok(!shouldGrantPermission('openExternal', APP, APP));
  assert.ok(Object.isFrozen(GRANTED_PERMISSIONS));
});

test('serverEnv turns Electron into Node without losing your API keys', () => {
  const base = { OPENAI_API_KEY: 'sk-test-not-real', PATH: '/usr/bin' };
  const env = serverEnv(base, 5555);
  assert.equal(env.ELECTRON_RUN_AS_NODE, '1');
  assert.equal(env.GEV_ELECTRON_PORT, '5555');
  assert.equal(env.OPENAI_API_KEY, 'sk-test-not-real');
  assert.equal(
    base.ELECTRON_RUN_AS_NODE,
    undefined,
    'must not mutate the caller env',
  );
});

test('window keeps the renderer locked down', () => {
  const { webPreferences, title, show } = windowOptions();
  assert.deepEqual(webPreferences, {
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  });
  assert.equal(title, APP_NAME);
  assert.equal(show, false, 'show after ready-to-show to avoid a white flash');
});

test('window icon is only passed where the platform listens to it', () => {
  assert.equal(
    windowOptions({ iconPath: '/x.png', platform: 'linux' }).icon,
    '/x.png',
  );
  assert.equal(
    windowOptions({ iconPath: '/x.icns', platform: 'darwin' }).icon,
    undefined,
  );
});

test('iconPathFor picks icns on macOS and png elsewhere', () => {
  assert.equal(iconPathFor('/a', 'darwin'), path.join('/a', 'icon.icns'));
  assert.equal(iconPathFor('/a', 'win32'), path.join('/a', 'icon.png'));
});

test('loadingQuip is deterministic with a seed and never out of quips', () => {
  assert.equal(loadingQuip(0), loadingQuip(0));
  for (const seed of [0, 0.2, 0.5, 0.999, 1, -3]) {
    assert.equal(typeof loadingQuip(seed), 'string');
  }
});

test('splash escapes quips, in case one ever tries <script> stand-up', () => {
  const html = splashHtml('<script>alert("ha")</script>');
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('&#60;script&#62;'));
});

test('splashUrl is a self-contained data URL', () => {
  const url = splashUrl('Counting ships.');
  assert.ok(url.startsWith('data:text/html;charset=utf-8,'));
  assert.ok(decodeURIComponent(url).includes('Counting ships.'));
});
