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
  // Fallback: render DSL text as a styled SVG placeholder
  const escaped = syntax
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // Parse first line for the template name to show as title
  const lines = syntax.trim().split('\n');
  const templateName = lines[0] || 'infographic';
  const bodyLines = lines.slice(1).join('\n');
  const escapedTitle = templateName.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const escapedBody = bodyLines
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Build tspan elements for each line (SVG foreignObject has poor SVG rasterizer support in sharp)
  const bodyLineArr = bodyLines.split('\n').slice(0, 40); // cap at 40 lines
  const tspans = bodyLineArr
    .map((line, i) => {
      const safeText = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
      return `<tspan x="60" dy="${i === 0 ? 0 : 22}">${safeText}</tspan>`;
    })
    .join('');

  svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="#ffffff"/>
  <rect x="0" y="0" width="${width}" height="8" fill="#4F46E5"/>
  <text x="60" y="70" font-family="ui-sans-serif, system-ui, sans-serif" font-size="32" font-weight="700" fill="#4F46E5">${escapedTitle}</text>
  <line x1="60" y1="90" x2="${width - 60}" y2="90" stroke="#e2e8f0" stroke-width="2"/>
  <text x="60" y="130" font-family="ui-monospace, monospace" font-size="18" fill="#334155" xml:space="preserve">
    ${tspans}
  </text>
  <text x="${width - 40}" y="${height - 20}" font-family="ui-sans-serif, sans-serif" font-size="14" fill="#94a3b8" text-anchor="end">OpenMontage · infographic placeholder</text>
</svg>`;
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
