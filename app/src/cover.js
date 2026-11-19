// The cover engine: draws the whole poster — panels, grades, skyline, lettering,
// grain and vignette — onto any canvas at any size, so the live preview and the
// exported PNG are the same drawing. Nothing here touches the network.

import { gradeById, paintWash } from './grades.js';
import { layoutById, panelRects } from './layouts.js';

/** Export sizes, in pixels. */
export const SIZES = {
  square: { w: 1080, h: 1080, label: '1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: '1080 × 1350' },
  wide: { w: 1920, h: 1080, label: '1920 × 1080' },
};

/** A small deterministic PRNG, so grain and skylines look the same on every draw. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Draws the cover described by `state` onto `canvas` at the canvas's own size.
 * state: { layout, grade, title, subtitle, heat, grain, frame, photos, panels, selected }
 * photos: image elements (or null); panels: { photo, zoom, ox, oy } per layout slot.
 */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const layout = layoutById(state.layout);
  const grade = gradeById(state.grade);
  const rects = panelRects(layout.id);
  const gutter = state.frame ? Math.max(4, Math.round(W * 0.008)) : 0;

  ctx.save();
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = state.frame ? '#ffffff' : '#160a24';
  ctx.fillRect(0, 0, W, H);

  if (layout.id === 'tilted') drawSunsetSkyline(ctx, W, H);
  rects.forEach((rect, i) => {
    drawPhotoPanel(ctx, rect, state.panels[i], state.photos, grade, W, H, gutter, layout.id === 'tilted');
  });

  drawTitleBlock(ctx, state, W, H);
  drawHeatStars(ctx, state.heat, W, H);
  drawEditionBadge(ctx, W, H);
  if (state.grain) drawGrain(ctx, W, H);
  drawVignette(ctx, W, H);
  if (state.selected != null && state.selected < rects.length && layout.id !== 'tilted') {
    drawPanelSelection(ctx, rects[state.selected], W, H, gutter);
  }
  ctx.restore();
}

/** Renders the same cover at export size and returns the fresh canvas. */
export function exportCover(state, sizeId) {
  const size = SIZES[sizeId] ?? SIZES.square;
  const canvas = document.createElement('canvas');
  canvas.width = size.w;
  canvas.height = size.h;
  renderCover(canvas, { ...state, selected: null });
  return canvas;
}

/** Draws one photo into its panel rectangle, graded, cropped and positioned. */
export function drawPhotoPanel(ctx, rect, panel, photos, grade, W, H, gutter, snapshot) {
  const px = rect.x * W;
  const py = rect.y * H;
  const pw = rect.w * W;
  const ph = rect.h * H;
  const img = panel && panel.photo != null ? photos[panel.photo] : null;

  ctx.save();
  if (snapshot) {
    // A tilted snapshot: white polaroid border, thicker at the foot, rotated.
    ctx.translate(px + pw / 2, py + ph / 2);
    ctx.rotate((rect.rot * Math.PI) / 180);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = W * 0.02;
    ctx.shadowOffsetY = W * 0.006;
    ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    const inset = pw * 0.035;
    ctx.beginPath();
    ctx.rect(-pw / 2 + inset, -ph / 2 + inset, pw - inset * 2, ph - inset - pw * 0.09);
    ctx.clip();
    ctx.translate(-pw / 2 + inset, -ph / 2 + inset);
    drawPhotoInto(ctx, img, panel, pw - inset * 2, ph - inset - pw * 0.09, grade);
    ctx.restore();
    return;
  }

  const ix = px + gutter / 2;
  const iy = py + gutter / 2;
  const iw = pw - gutter;
  const ih = ph - gutter;
  ctx.beginPath();
  ctx.rect(ix, iy, iw, ih);
  ctx.clip();
  ctx.translate(ix, iy);
  drawPhotoInto(ctx, img, panel, iw, ih, grade);
  ctx.restore();
}

/** Fills a w × h box with the photo (cover-fit, zoomed, panned) and the grade. */
export function drawPhotoInto(ctx, img, panel, w, h, grade) {
  if (!img) {
    // An empty panel: a dusk gradient with a dashed outline, inviting a photo.
    const empty = ctx.createLinearGradient(0, 0, w, h);
    empty.addColorStop(0, '#3d1a5e');
    empty.addColorStop(1, '#7a2a6e');
    ctx.fillStyle = empty;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = Math.max(2, w * 0.006);
    ctx.setLineDash([w * 0.03, w * 0.02]);
    ctx.strokeRect(w * 0.06, h * 0.06, w * 0.88, h * 0.88);
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = `700 ${Math.max(14, w * 0.045)}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText('+ add a photo', w / 2, h / 2 + w * 0.015);
    return;
  }
  const zoom = panel?.zoom ?? 1;
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight) * zoom;
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = (w - dw) / 2 + (panel?.ox ?? 0) * w;
  const dy = (h - dh) / 2 + (panel?.oy ?? 0) * h;
  ctx.save();
  ctx.filter = grade.filter;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
  grade.washes.forEach((wash) => paintWash(ctx, wash, 0, 0, w, h));
}

/** A procedural Vice City sunset: gradient sky, low sun, skyline and palms. */
export function drawSunsetSkyline(ctx, W, H) {
  const sky = ctx.createLinearGradient(0, 0, 0, H * 0.66);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.45, '#c2185b');
  sky.addColorStop(0.8, '#ff7a3d');
  sky.addColorStop(1, '#ffd76a');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H * 0.66);
  ctx.fillStyle = '#1c0b33';
  ctx.fillRect(0, H * 0.66, W, H * 0.34);

  // The sun, low over the skyline, with a halo.
  const sunX = W * 0.72;
  const sunY = H * 0.34;
  const sunR = W * 0.085;
  const halo = ctx.createRadialGradient(sunX, sunY, sunR * 0.2, sunX, sunY, sunR * 3.2);
  halo.addColorStop(0, 'rgba(255,215,106,0.75)');
  halo.addColorStop(1, 'rgba(255,215,106,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(sunX - sunR * 3.2, sunY - sunR * 3.2, sunR * 6.4, sunR * 6.4);
  ctx.fillStyle = '#ffe9a8';
  ctx.beginPath();
  ctx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
  ctx.fill();

  // Skyline blocks with lit windows, drawn from a fixed seed.
  const rand = mulberry32(20261119);
  const base = H * 0.66;
  let x = -W * 0.02;
  ctx.fillStyle = '#160a24';
  while (x < W) {
    const bw = W * (0.06 + rand() * 0.09);
    const bh = H * (0.08 + rand() * 0.16);
    ctx.fillRect(x, base - bh, bw, bh);
    ctx.fillStyle = 'rgba(255,215,106,0.85)';
    const cols = Math.max(1, Math.floor(bw / (W * 0.018)));
    const rows = Math.max(1, Math.floor(bh / (H * 0.03)));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        if (rand() < 0.28) ctx.fillRect(x + W * 0.008 + c * W * 0.018, base - bh + H * 0.012 + r * H * 0.03, W * 0.007, H * 0.012);
      }
    }
    ctx.fillStyle = '#160a24';
    x += bw + W * 0.008;
  }
  drawPalm(ctx, W * 0.08, base, H * 0.2);
  drawPalm(ctx, W * 0.93, base, H * 0.16);
}

/** One palm silhouette: a leaning trunk and seven drooping fronds. */
export function drawPalm(ctx, x, groundY, height) {
  ctx.save();
  ctx.strokeStyle = '#160a24';
  ctx.fillStyle = '#160a24';
  ctx.lineWidth = Math.max(3, height * 0.03);
  ctx.beginPath();
  ctx.moveTo(x, groundY);
  ctx.quadraticCurveTo(x + height * 0.08, groundY - height * 0.55, x + height * 0.16, groundY - height);
  ctx.stroke();
  const topX = x + height * 0.16;
  const topY = groundY - height;
  for (let i = 0; i < 7; i++) {
    const a = (Math.PI * (0.08 + i * 0.14));
    ctx.beginPath();
    ctx.moveTo(topX, topY);
    ctx.quadraticCurveTo(
      topX + Math.cos(a) * height * 0.34,
      topY - Math.sin(a) * height * 0.22,
      topX + Math.cos(a) * height * 0.52,
      topY + height * 0.16,
    );
    ctx.lineWidth = Math.max(2, height * 0.022);
    ctx.stroke();
  }
  ctx.restore();
}

/** The title block: scrim, gradient Anton title, neon Pacifico subtitle. */
export function drawTitleBlock(ctx, state, W, H) {
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim();
  const scrimTop = H * (state.layout === 'tilted' ? 0.82 : 0.6);
  const scrim = ctx.createLinearGradient(0, scrimTop, 0, H);
  scrim.addColorStop(0, 'rgba(12,4,24,0)');
  scrim.addColorStop(1, 'rgba(12,4,24,0.78)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, W, H - scrimTop);

  if (subtitle) {
    let subSize = H * 0.048;
    ctx.font = `${subSize}px Pacifico, cursive`;
    while (ctx.measureText(subtitle).width > W * 0.86 && subSize > 10) {
      subSize -= 1;
      ctx.font = `${subSize}px Pacifico, cursive`;
    }
    ctx.save();
    ctx.translate(W / 2, H * 0.825);
    ctx.rotate(-0.02);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ff2e88';
    ctx.shadowBlur = subSize * 0.6;
    ctx.fillText(subtitle, 0, 0);
    ctx.restore();
  }

  if (title) {
    let size = H * 0.105;
    ctx.font = `${size}px Anton, sans-serif`;
    while (ctx.measureText(title).width > W * 0.92 && size > 12) {
      size -= 2;
      ctx.font = `${size}px Anton, sans-serif`;
    }
    ctx.save();
    ctx.translate(W / 2, H * 0.96);
    ctx.rotate(-0.012);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    const fill = ctx.createLinearGradient(0, -size, 0, size * 0.1);
    fill.addColorStop(0, '#ffd76a');
    fill.addColorStop(0.55, '#ff7a3d');
    fill.addColorStop(1, '#ff2e88');
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = size * 0.045;
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.12;
    ctx.shadowOffsetY = size * 0.03;
    ctx.strokeText(title, 0, 0);
    ctx.fillStyle = fill;
    ctx.fillText(title, 0, 0);
    ctx.restore();
  }
}

/** Five stars top-right on a dark HUD chip; `heat` of them burn gold, the rest stay outlined. */
export function drawHeatStars(ctx, heat, W, H) {
  const n = 5;
  const r = W * 0.022;
  const gap = r * 2.5;
  const total = n * gap - (gap - r * 2);
  const chipX = W - total - W * 0.035;
  const chipY = H * 0.02;
  ctx.save();
  ctx.fillStyle = 'rgba(12,4,24,0.55)';
  roundRect(ctx, chipX - r * 0.7, chipY, total + r * 1.4, r * 2 + chipY * 0.9, r * 0.8);
  ctx.fill();
  let x = chipX;
  const y = chipY + r * 0.95 + chipY * 0.45;
  for (let i = 0; i < n; i++) {
    drawStar(ctx, x + r, y, r, i < heat);
    x += gap;
  }
  ctx.restore();
}

/** A filled rounded rectangle path, for HUD chips. */
export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** One five-pointed star, gold when lit, dark outline when not. */
export function drawStar(ctx, cx, cy, r, lit) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    const x = cx + Math.cos(a) * rad;
    const y = cy + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fillStyle = lit ? '#ffd76a' : 'rgba(12,4,24,0.55)';
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = Math.max(1.5, r * 0.12);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** A small slanted ribbon top-left naming the edition. */
export function drawEditionBadge(ctx, W, H) {
  const text = 'SUNSET EDITION';
  const size = Math.max(13, W * 0.016);
  ctx.save();
  ctx.translate(W * 0.028, H * 0.032);
  ctx.rotate(-0.03);
  ctx.font = `${size}px Anton, sans-serif`;
  const tw = ctx.measureText(text).width;
  const padX = size * 0.9;
  const padY = size * 0.55;
  ctx.fillStyle = '#ff2e88';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(tw + padX * 2, 0);
  ctx.lineTo(tw + padX * 2 - size * 0.5, size + padY * 2);
  ctx.lineTo(-size * 0.5, size + padY * 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(text, padX, padY);
  ctx.restore();
}

/** Film grain: a seeded noise tile stamped over the cover at low alpha. */
export function drawGrain(ctx, W, H) {
  const tile = document.createElement('canvas');
  tile.width = 160;
  tile.height = 160;
  const tctx = tile.getContext('2d');
  const image = tctx.createImageData(160, 160);
  const rand = mulberry32(20261119);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    image.data[i] = v;
    image.data[i + 1] = v;
    image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  tctx.putImageData(image, 0, 0);
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = ctx.createPattern(tile, 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** A soft darkening toward the corners, the poster-print feel. */
export function drawVignette(ctx, W, H) {
  const grad = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  grad.addColorStop(0, 'rgba(0,0,0,0)');
  grad.addColorStop(1, 'rgba(10,2,20,0.34)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);
}

/** A pink outline around the panel the editor has selected. */
export function drawPanelSelection(ctx, rect, W, H, gutter) {
  ctx.save();
  ctx.strokeStyle = '#ff2e88';
  ctx.lineWidth = Math.max(3, W * 0.006);
  ctx.setLineDash([W * 0.02, W * 0.012]);
  ctx.strokeRect(rect.x * W + gutter / 2, rect.y * H + gutter / 2, rect.w * W - gutter, rect.h * H - gutter);
  ctx.restore();
}
