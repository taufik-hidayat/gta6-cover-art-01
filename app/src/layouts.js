// Panel layouts: where each photo panel sits on the cover, as fractions of the cover.
// Every layout also reserves the bottom band for the title block, which the renderer
// draws over the panels with a scrim.

/** The layouts the studio offers, in menu order. */
export const LAYOUTS = [
  { id: 'hero', name: 'Hero + 3', panels: 4, blurb: 'One big hero shot, three beside and below it' },
  { id: 'nine', name: 'Nine Panel', panels: 9, blurb: 'The classic 3 × 3 poster grid' },
  { id: 'bleed', name: 'Full Bleed', panels: 1, blurb: 'One photo edge to edge, title over it' },
  { id: 'tilted', name: 'Tilted Snaps', panels: 4, blurb: 'Snapshots scattered over a sunset skyline' },
];

/** Looks a layout up by id, falling back to the first layout. */
export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) ?? LAYOUTS[0];
}

/**
 * Returns the panel rectangles for a layout, each {x, y, w, h, rot} in fractions of
 * the cover (rot in degrees, 0 when the panel sits straight). `tilted` panels overlap
 * and are drawn in order, so later panels sit on top of earlier ones.
 */
export function panelRects(layoutId) {
  if (layoutId === 'nine') {
    const rects = [];
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        rects.push({ x: col / 3, y: row / 3, w: 1 / 3, h: 1 / 3, rot: 0 });
      }
    }
    return rects;
  }
  if (layoutId === 'bleed') {
    return [{ x: 0, y: 0, w: 1, h: 1, rot: 0 }];
  }
  if (layoutId === 'tilted') {
    return [
      { x: 0.05, y: 0.05, w: 0.46, h: 0.46, rot: -4 },
      { x: 0.50, y: 0.03, w: 0.44, h: 0.40, rot: 3 },
      { x: 0.07, y: 0.47, w: 0.42, h: 0.38, rot: 2.5 },
      { x: 0.51, y: 0.44, w: 0.44, h: 0.42, rot: -3 },
    ];
  }
  // hero: big hero top-left, two stacked on the right, one wide strip along the bottom.
  return [
    { x: 0, y: 0, w: 0.64, h: 0.62, rot: 0 },
    { x: 0.64, y: 0, w: 0.36, h: 0.31, rot: 0 },
    { x: 0.64, y: 0.31, w: 0.36, h: 0.31, rot: 0 },
    { x: 0, y: 0.62, w: 1, h: 0.38, rot: 0 },
  ];
}
