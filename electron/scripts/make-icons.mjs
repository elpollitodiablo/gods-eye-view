#!/usr/bin/env node
// Turns public/logo.svg (a very wide eye) into a square app icon, because
// the macOS Dock has strong opinions about aspect ratios.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
const ASSETS = path.join(ROOT, 'electron/assets');
const SIZE = 1024;
// Apple's icon grid: ~10% margin around an 824px rounded square.
const TILE = 824;
const RADIUS = 185;

const tile =
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}">
  <defs>
    <radialGradient id="bg" cx="50%" cy="40%" r="70%">
      <stop offset="0%" stop-color="#14233d"/>
      <stop offset="100%" stop-color="#050a14"/>
    </radialGradient>
  </defs>
  <rect x="${(SIZE - TILE) / 2}" y="${(SIZE - TILE) / 2}" width="${TILE}" height="${TILE}"
        rx="${RADIUS}" fill="url(#bg)" stroke="#00f6ff" stroke-opacity="0.35" stroke-width="6"/>
</svg>`);

export async function renderIconPng(size = SIZE) {
  const logoWidth = 700;
  const logo = await sharp(readFileSync(path.join(ROOT, 'public/logo.svg')), {
    density: 300,
  })
    .resize({ width: logoWidth })
    .png()
    .toBuffer();
  const { height } = await sharp(logo).metadata();
  const full = await sharp(tile)
    .composite([
      {
        input: logo,
        left: (SIZE - logoWidth) / 2,
        top: Math.round((SIZE - height) / 2),
      },
    ])
    .png()
    .toBuffer();
  return size === SIZE ? full : sharp(full).resize(size, size).png().toBuffer();
}

async function main() {
  mkdirSync(ASSETS, { recursive: true });
  await sharp(await renderIconPng()).toFile(path.join(ASSETS, 'icon.png'));

  if (process.platform !== 'darwin') {
    console.log(
      'icon.png written; skipping .icns (iconutil is a macOS-only treat).',
    );
    return;
  }
  const iconset = path.join(ASSETS, 'icon.iconset');
  rmSync(iconset, { recursive: true, force: true });
  mkdirSync(iconset);
  for (const base of [16, 32, 128, 256, 512]) {
    await sharp(await renderIconPng(base)).toFile(
      path.join(iconset, `icon_${base}x${base}.png`),
    );
    await sharp(await renderIconPng(base * 2)).toFile(
      path.join(iconset, `icon_${base}x${base}@2x.png`),
    );
  }
  execFileSync('iconutil', [
    '-c',
    'icns',
    iconset,
    '-o',
    path.join(ASSETS, 'icon.icns'),
  ]);
  rmSync(iconset, { recursive: true, force: true });
  console.log(
    'icon.png + icon.icns written. The eye sees all, now in 10 resolutions.',
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
