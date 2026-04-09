// tools/graphics/_infographic_renderer.js
// Usage: node _infographic_renderer.js "<dsl>" <output.png> [width] [height]
import { fileURLToPath } from 'url';
import path from 'path';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const syntax = process.argv[2];
const outputPath = process.argv[3];
const width = parseInt(process.argv[4], 10) || 1920;
const height = parseInt(process.argv[5], 10) || 1080;

if (!syntax || !outputPath) {
  console.error('Usage: node _infographic_renderer.js "<dsl>" <output.png> [w] [h]');
  process.exit(1);
}

// Try to load @antv/infographic SSR from Infographic-original repo
let renderToString = null;
const infographicPath = path.join(process.env.HOME, 'Coding/Infographic-original');

try {
  // Try ESM build first, then CJS
  const esmPath = `${infographicPath}/esm/ssr/index.js`;
  const mod = await import(esmPath);
  renderToString = mod.renderToString || mod.default?.renderToString;
  if (renderToString) {
    console.error('[renderer] SSR loaded from ESM build');
  }
} catch (_e1) {
  try {
    // Try CJS build via dynamic import (Node supports this)
    const cjsPath = `${infographicPath}/lib/ssr/index.js`;
    const mod = await import(cjsPath);
    renderToString = mod.renderToString || mod.default?.renderToString;
    if (renderToString) {
      console.error('[renderer] SSR loaded from CJS build');
    }
  } catch (_e2) {
    // SSR not available — will use fallback
    console.error('[renderer] SSR not available (repo not built), using placeholder fallback');
  }
}

let svgString;
if (renderToString) {
  try {
    svgString = await renderToString(syntax);
  } catch (err) {
    console.error('[renderer] renderToString failed:', err.message, '— falling back to placeholder');
    renderToString = null;
  }
}

if (!renderToString) {
  // Fallback: parse DSL and render a styled infographic SVG (no raw text, no watermark)
  const lines = syntax.trim().split('\n');

  // Parse DSL: extract labels from "- label ..." lines
  const labels = [];
  for (const line of lines) {
    const m = line.match(/^\s*-\s*label\s+(.+)/);
    if (m) labels.push(m[1].trim());
  }

  // Parse DSL: extract title from first line (e.g. "infographic list-row-simple-horizontal-arrow")
  const titleLine = (lines[0] || 'Infographic').replace(/^infographic\s*/i, '').replace(/-/g, ' ');

  // Colors
  const primary = '#4F46E5';
  const accent = '#6b00b8';
  const surface = '#f8f9ff';
  const textPrimary = '#1e293b';
  const textSecondary = '#64748b';

  if (labels.length > 0) {
    // Render as styled card list
    const cardH = 80;
    const cardGap = 16;
    const startY = 160;
    const cardX = 100;
    const cardW = width - 200;
    const totalH = labels.length * (cardH + cardGap);
    const offsetY = Math.max(startY, (height - totalH) / 2);

    const cards = labels.map((label, i) => {
      const y = offsetY + i * (cardH + cardGap);
      const esc = label.replace(/&/g, '&amp;').replace(/</g, '&lt;');
      const barColor = i % 2 === 0 ? primary : accent;
      return `
        <rect x="${cardX}" y="${y}" width="${cardW}" height="${cardH}" rx="12" fill="${surface}" stroke="#e0e7ff" stroke-width="1"/>
        <rect x="${cardX}" y="${y}" width="6" height="${cardH}" rx="3" fill="${barColor}"/>
        <circle cx="${cardX + 50}" cy="${y + cardH / 2}" r="16" fill="${barColor}" opacity="0.12"/>
        <text x="${cardX + 50}" y="${y + cardH / 2 + 5}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="16" fill="${barColor}" text-anchor="middle" font-weight="700">${i + 1}</text>
        <text x="${cardX + 90}" y="${y + cardH / 2 + 7}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="26" fill="${textPrimary}" font-weight="600">${esc}</text>
      `;
    }).join('');

    const escTitle = titleLine.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#ffffff"/>
      <text x="${width / 2}" y="80" font-family="ui-sans-serif, system-ui, sans-serif" font-size="40" font-weight="800" fill="${primary}" text-anchor="middle">${escTitle}</text>
      <line x1="${width / 2 - 60}" y1="100" x2="${width / 2 + 60}" y2="100" stroke="${primary}" stroke-width="3" stroke-linecap="round"/>
      ${cards}
    </svg>`;
  } else {
    // Generic fallback — centered title only
    const escTitle = titleLine.replace(/&/g, '&amp;').replace(/</g, '&lt;');
    svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="${width}" height="${height}" fill="#ffffff"/>
      <text x="${width / 2}" y="${height / 2}" font-family="ui-sans-serif, system-ui, sans-serif" font-size="48" font-weight="700" fill="${primary}" text-anchor="middle">${escTitle}</text>
    </svg>`;
  }
}

try {
  await sharp(Buffer.from(svgString))
    .resize(width, height, { fit: 'contain', background: '#ffffff' })
    .png()
    .toFile(outputPath);
  console.log(`OK: ${outputPath}`);
} catch (err) {
  console.error('Render error:', err.message);
  process.exit(1);
}
