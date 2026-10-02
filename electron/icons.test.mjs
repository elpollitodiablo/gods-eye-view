import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const ASSETS = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'assets',
);

test('icon.png is a real 1024px PNG and not a suspiciously small eye', () => {
  const png = readFileSync(path.join(ASSETS, 'icon.png'));
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
  assert.equal(png.readUInt32BE(16), 1024, 'width');
  assert.equal(png.readUInt32BE(20), 1024, 'height');
});

test('icon.icns exists and carries the icns magic', () => {
  const file = path.join(ASSETS, 'icon.icns');
  assert.ok(existsSync(file), 'run npm run electron:icons on macOS');
  assert.equal(readFileSync(file).subarray(0, 4).toString('ascii'), 'icns');
});
