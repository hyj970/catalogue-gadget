// LOOP-1 catalogue photo entry for make.fun.
// Renders a 1024x1024 studio product shot of an impossible gadget — a white
// power strip plugged into itself, with a small desk lamp proving it works —
// using headless Chromium + real fonts, then writes /output/entry.png and
// reads it back for a byte-for-byte self-check.
//
// Runs on Node 22+, standard library only, no network:
//   node main.ts            (writes /output/entry.png)
//   MAKEFUN_OUTPUT_DIR=out node main.ts

import { execFileSync } from 'node:child_process';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BYTES = 1048576;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// ---------------------------------------------------------------------------
// Scene: a single hand-drawn SVG, 1024x1024. No external images, no fonts
// fetched from the network — DejaVu Sans is installed on the system.
// ---------------------------------------------------------------------------
const SCENE_HTML = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:1024px;height:1024px;overflow:hidden}
  svg{display:block;width:1024px;height:1024px}
</style></head><body>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#eeeeec"/>
      <stop offset="0.55" stop-color="#e3e3e0"/>
      <stop offset="1" stop-color="#d3d3d0"/>
    </linearGradient>
    <radialGradient id="toplight" cx="0.22" cy="0.10" r="0.75">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.55"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="stripTop" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff"/>
      <stop offset="1" stop-color="#eeeeeb"/>
    </linearGradient>
    <linearGradient id="stripFront" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e2e2df"/>
      <stop offset="1" stop-color="#cfcfcc"/>
    </linearGradient>
    <linearGradient id="lampBody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a4a4a"/>
      <stop offset="1" stop-color="#262626"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#ffc46b" stop-opacity="0.85"/>
      <stop offset="0.45" stop-color="#ffb84d" stop-opacity="0.38"/>
      <stop offset="1" stop-color="#ffb84d" stop-opacity="0"/>
    </radialGradient>
    <filter id="soft12" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="12"/>
    </filter>
    <filter id="soft6" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur stdDeviation="6"/>
    </filter>
  </defs>

  <!-- seamless studio background -->
  <rect width="1024" height="1024" fill="url(#bg)"/>
  <rect width="1024" height="1024" fill="url(#toplight)"/>

  <!-- soft shadows on the surface -->
  <ellipse cx="512" cy="640" rx="355" ry="26" fill="#000000" opacity="0.16" filter="url(#soft12)"/>
  <ellipse cx="790" cy="812" rx="150" ry="16" fill="#000000" opacity="0.10" filter="url(#soft12)"/>
  <ellipse cx="140" cy="672" rx="72" ry="12" fill="#000000" opacity="0.15" filter="url(#soft6)"/>

  <!-- warm lamp glow (behind the lamp, over the background) -->
  <circle cx="118" cy="512" r="240" fill="url(#glow)"/>
  <ellipse cx="160" cy="668" rx="135" ry="22" fill="#ffb84d" opacity="0.22" filter="url(#soft12)"/>

  <!-- ============ the self-plug cable loop ============ -->
  <!-- exits the right end of the strip, sweeps down in a wide loop,
       comes back up and plugs into the strip's own rightmost socket -->
  <path d="M 834 524 C 895 528, 928 585, 922 650 C 916 722, 860 790, 770 800
           C 690 808, 640 770, 655 705 C 668 650, 700 610, 710 566
           C 711 540, 711 505, 712 472"
        fill="none" stroke="#353535" stroke-width="15" stroke-linecap="round"/>

  <!-- ============ desk lamp (the one accessory) ============ -->
  <!-- cable from lamp base up to the lamp plug, seated in socket 1 -->
  <path d="M 172 648 C 214 670, 252 656, 274 614 C 288 586, 294 548, 296 512"
        fill="none" stroke="#3a3a3a" stroke-width="7" stroke-linecap="round"/>
  <!-- lamp plug, seated in socket 1, body clearly visible above the socket -->
  <g transform="rotate(-10 312 486)">
    <rect x="288" y="448" width="48" height="76" rx="11" fill="#f4f4f2" stroke="#c9c9c6" stroke-width="1.5"/>
    <line x1="302" y1="522" x2="302" y2="534" stroke="#9a9a9a" stroke-width="4" stroke-linecap="round"/>
    <line x1="322" y1="522" x2="322" y2="534" stroke="#9a9a9a" stroke-width="4" stroke-linecap="round"/>
  </g>
  <!-- base, stem, shade, bulb -->
  <rect x="82" y="620" width="96" height="38" rx="14" fill="url(#lampBody)"/>
  <ellipse cx="130" cy="658" rx="48" ry="9" fill="#1c1c1c"/>
  <line x1="130" y1="624" x2="118" y2="508" stroke="#2e2e2e" stroke-width="9" stroke-linecap="round"/>
  <path d="M 80 508 L 156 508 L 142 450 L 94 450 Z" fill="url(#lampBody)"/>
  <ellipse cx="118" cy="508" rx="38" ry="7" fill="#151515"/>
  <circle cx="118" cy="514" r="12" fill="#ffe1a1"/>
  <circle cx="118" cy="514" r="19" fill="#ffcf7d" opacity="0.55"/>

  <!-- ============ the power strip ============ -->
  <!-- front face -->
  <rect x="190" y="538" width="644" height="56" rx="20" fill="url(#stripFront)"/>
  <!-- top face -->
  <rect x="190" y="478" width="644" height="92" rx="26" fill="url(#stripTop)"/>
  <rect x="190" y="478" width="644" height="92" rx="26" fill="none" stroke="#c6c6c3" stroke-width="1.5"/>
  <!-- seam highlight between top and front face -->
  <line x1="196" y1="570" x2="828" y2="570" stroke="#ffffff" stroke-width="2" opacity="0.7"/>

  <!-- rocker switch, left end -->
  <rect x="208" y="502" width="46" height="44" rx="9" fill="#f2f2f0" stroke="#c4c4c1" stroke-width="1.5"/>
  <line x1="231" y1="512" x2="231" y2="526" stroke="#c0392b" stroke-width="4" stroke-linecap="round"/>
  <circle cx="231" cy="536" r="3.5" fill="none" stroke="#8a8a8a" stroke-width="2.5"/>

  <!-- four sockets -->
  <g>
    <ellipse cx="320" cy="524" rx="46" ry="28" fill="#1f1f1f"/>
    <ellipse cx="320" cy="524" rx="38" ry="22" fill="#333333"/>
    <ellipse cx="450" cy="524" rx="46" ry="28" fill="#1f1f1f"/>
    <ellipse cx="450" cy="524" rx="38" ry="22" fill="#333333"/>
    <ellipse cx="437" cy="524" rx="7" ry="10" fill="#0a0a0a"/>
    <ellipse cx="463" cy="524" rx="7" ry="10" fill="#0a0a0a"/>
    <ellipse cx="580" cy="524" rx="46" ry="28" fill="#1f1f1f"/>
    <ellipse cx="580" cy="524" rx="38" ry="22" fill="#333333"/>
    <ellipse cx="567" cy="524" rx="7" ry="10" fill="#0a0a0a"/>
    <ellipse cx="593" cy="524" rx="7" ry="10" fill="#0a0a0a"/>
    <ellipse cx="710" cy="524" rx="46" ry="28" fill="#1f1f1f"/>
    <ellipse cx="710" cy="524" rx="38" ry="22" fill="#333333"/>
  </g>

  <!-- loop plug, seated in socket 4 (rightmost) -->
  <g transform="rotate(8 710 496)">
    <rect x="687" y="466" width="46" height="58" rx="11" fill="#f4f4f2" stroke="#c9c9c6" stroke-width="1.5"/>
    <line x1="700" y1="522" x2="700" y2="534" stroke="#9a9a9a" stroke-width="4" stroke-linecap="round"/>
    <line x1="720" y1="522" x2="720" y2="534" stroke="#9a9a9a" stroke-width="4" stroke-linecap="round"/>
  </g>

  <!-- LED, on -->
  <circle cx="800" cy="524" r="11" fill="#22c55e" opacity="0.35"/>
  <circle cx="800" cy="524" r="6" fill="#2ecc71"/>

  <!-- brand on the front face -->
  <text x="512" y="576" text-anchor="middle"
        font-family="DejaVu Sans, sans-serif" font-size="21" font-weight="bold"
        letter-spacing="7" fill="#8a8a88">LOOP-1</text>

  <!-- discreet catalogue caption -->
  <text x="512" y="958" text-anchor="middle"
        font-family="DejaVu Sans, sans-serif" font-size="26"
        letter-spacing="5" fill="#8b8b89">LOOP-1 &#183; $49.99</text>
</svg>
</body></html>
`;

function checkImage(bytes) {
  if (!bytes.subarray(0, 8).equals(PNG_MAGIC)) {
    throw new Error('entry.png does not start with the PNG signature');
  }
  const width = bytes.readUInt32BE(16);
  const height = bytes.readUInt32BE(20);
  if (width !== 1024 || height !== 1024) {
    throw new Error(`entry.png is ${width}x${height}, expected exactly 1024x1024`);
  }
  if (bytes.length > MAX_BYTES) {
    throw new Error(`entry.png is ${bytes.length} bytes, over the ${MAX_BYTES} byte limit`);
  }
}

function findChromium() {
  const envPath = process.env.CHROMIUM_PATH;
  if (envPath && existsSync(envPath)) return envPath;
  const cache = join(homedir(), '.cache', 'ms-playwright');
  if (existsSync(cache)) {
    for (const dir of readdirSync(cache)) {
      const full = join(cache, dir, 'chrome-linux64', 'chrome');
      if (existsSync(full)) return full;
      const shell = join(cache, dir, 'chrome-headless-shell-linux64', 'headless_shell');
      if (existsSync(shell)) return shell;
    }
  }
  for (const name of ['chromium', 'chromium-browser', 'google-chrome', 'google-chrome-stable']) {
    try {
      const found = execFileSync('which', [name], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
      if (found) return found;
    } catch {
      // not on PATH, try the next name
    }
  }
  throw new Error('no headless Chromium found (set CHROMIUM_PATH or install Playwright Chromium)');
}

const repoDir = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const target = join(outDir, 'entry.png');

const workDir = mkdtempSync(join(tmpdir(), 'catalogue-gadget-'));
const htmlPath = join(workDir, 'scene.html');
const pngPath = join(workDir, 'entry.png');
writeFileSync(htmlPath, SCENE_HTML);

const chrome = findChromium();
execFileSync(
  chrome,
  [
    '--headless',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    '--force-device-scale-factor=1',
    '--window-size=1024,1024',
    `--screenshot=${pngPath}`,
    '--virtual-time-budget=3000',
    `file://${htmlPath}`,
  ],
  { stdio: 'pipe', timeout: 60000 },
);

const rendered = readFileSync(pngPath);
checkImage(rendered);

mkdirSync(outDir, { recursive: true });
copyFileSync(pngPath, target);

const written = readFileSync(target);
if (written.length !== rendered.length || !rendered.equals(written)) {
  throw new Error(
    `entry.png copy mismatch: ${rendered.length} bytes rendered, ${written.length} bytes written`,
  );
}

console.log(`wrote ${target} (${written.length} bytes, 1024x1024, verified)`);
