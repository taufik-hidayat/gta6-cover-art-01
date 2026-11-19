// Colour grades: each one tints a photo the way a Vice City sunset or a neon night does.
// A grade is a canvas filter plus one or two translucent gradient washes drawn over the
// photo with a blend mode, so the photo underneath always stays recognisable.

/** All grades the studio offers, in menu order. */
export const GRADES = [
  {
    id: 'vice',
    name: 'Vice Sunset',
    swatch: 'linear-gradient(135deg,#ff2e88,#ff7a3d 55%,#ffd76a)',
    filter: 'saturate(1.25) contrast(1.08) brightness(1.02)',
    washes: [
      { gradient: ['#ff2e88', '#ff7a3d', '#ffd76a'], mode: 'overlay', alpha: 0.34, angle: 'vertical' },
      { gradient: ['rgba(123,47,247,0)', 'rgba(123,47,247,0.28)'], mode: 'soft-light', alpha: 1, angle: 'vertical' },
    ],
  },
  {
    id: 'neon',
    name: 'Neon Nights',
    swatch: 'linear-gradient(135deg,#19e3c2,#7b2ff7 55%,#ff2e88)',
    filter: 'saturate(1.45) contrast(1.18) brightness(0.98)',
    washes: [
      { gradient: ['#19e3c2', '#7b2ff7', '#ff2e88'], mode: 'overlay', alpha: 0.38, angle: 'diagonal' },
      { gradient: ['rgba(0,20,40,0.35)', 'rgba(0,20,40,0)'], mode: 'multiply', alpha: 1, angle: 'vertical' },
    ],
  },
  {
    id: 'golden',
    name: 'Golden Hour',
    swatch: 'linear-gradient(135deg,#ffd76a,#ff9d2e 60%,#ff5e3a)',
    filter: 'saturate(1.2) contrast(1.04) brightness(1.06) sepia(0.18)',
    washes: [
      { gradient: ['rgba(255,215,106,0.55)', 'rgba(255,122,61,0.28)'], mode: 'soft-light', alpha: 1, angle: 'vertical' },
      { gradient: ['rgba(255,180,80,0)', 'rgba(255,140,40,0.22)'], mode: 'overlay', alpha: 1, angle: 'vertical' },
    ],
  },
  {
    id: 'dusk',
    name: 'Dusk Purple',
    swatch: 'linear-gradient(135deg,#2b1055,#7b2ff7 55%,#c2185b)',
    filter: 'saturate(1.15) contrast(1.1) brightness(0.94)',
    washes: [
      { gradient: ['#2b1055', '#7b2ff7', '#ff2e88'], mode: 'overlay', alpha: 0.42, angle: 'vertical' },
      { gradient: ['rgba(20,8,48,0.4)', 'rgba(20,8,48,0)'], mode: 'multiply', alpha: 1, angle: 'vertical' },
    ],
  },
  {
    id: 'noir',
    name: 'Mono Noir',
    swatch: 'linear-gradient(135deg,#111,#888 55%,#fff)',
    filter: 'grayscale(1) contrast(1.28) brightness(1.03)',
    washes: [
      { gradient: ['rgba(255,215,106,0)', 'rgba(255,215,106,0.14)'], mode: 'overlay', alpha: 1, angle: 'vertical' },
    ],
  },
];

/** Looks a grade up by id, falling back to the first grade. */
export function gradeById(id) {
  return GRADES.find((g) => g.id === id) ?? GRADES[0];
}

/**
 * Paints one wash of a grade over the rectangle (x, y, w, h) of `ctx`.
 * `angle` is 'vertical' (top to bottom) or 'diagonal' (top-left to bottom-right).
 */
export function paintWash(ctx, wash, x, y, w, h) {
  const stops = wash.gradient;
  const grad = wash.angle === 'diagonal'
    ? ctx.createLinearGradient(x, y, x + w, y + h)
    : ctx.createLinearGradient(x, y, x, y + h);
  stops.forEach((color, i) => grad.addColorStop(stops.length === 1 ? 0 : i / (stops.length - 1), color));
  ctx.save();
  ctx.globalCompositeOperation = wash.mode;
  ctx.globalAlpha = wash.alpha;
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.restore();
}
