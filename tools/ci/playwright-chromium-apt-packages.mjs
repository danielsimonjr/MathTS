#!/usr/bin/env node
/**
 * Apt packages Playwright needs for Chromium on Ubuntu 24.04 and 26.04 x64.
 * Derived from playwright@1.62.1 nativeDeps. ubuntu26.04-x64 chromium + tools
 * is the same list as ubuntu24.04-x64. Re-check when bumping Playwright.
 */
import { readFileSync } from 'node:fs';

const NOBLE_CHROMIUM_AND_TOOLS = [
  'xvfb',
  'fonts-noto-color-emoji',
  'fonts-unifont',
  'libfontconfig1',
  'libfreetype6',
  'xfonts-cyrillic',
  'xfonts-scalable',
  'fonts-liberation',
  'fonts-ipafont-gothic',
  'fonts-wqy-zenhei',
  'fonts-tlwg-loma-otf',
  'fonts-freefont-ttf',
  'libasound2t64',
  'libatk-bridge2.0-0t64',
  'libatk1.0-0t64',
  'libatspi2.0-0t64',
  'libcairo2',
  'libcups2t64',
  'libdbus-1-3',
  'libdrm2',
  'libgbm1',
  'libglib2.0-0t64',
  'libnspr4',
  'libnss3',
  'libpango-1.0-0',
  'libx11-6',
  'libxcb1',
  'libxcomposite1',
  'libxdamage1',
  'libxext6',
  'libxfixes3',
  'libxkbcommon0',
  'libxrandr2',
];

function isSupportedUbuntu() {
  try {
    const osRelease = readFileSync('/etc/os-release', 'utf8');
    return /VERSION_ID="(?:24|26)\.04"/.test(osRelease);
  } catch {
    return false;
  }
}

if (!isSupportedUbuntu()) {
  console.error(
    'playwright-chromium-apt-packages.mjs: expected Ubuntu 24.04 or 26.04; package list may be wrong',
  );
  process.exit(1);
}

for (const pkg of NOBLE_CHROMIUM_AND_TOOLS) {
  console.log(pkg);
}
