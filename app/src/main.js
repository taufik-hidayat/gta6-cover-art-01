// Wires the studio: photos in, layout and grade picked, caption typed, cover out.
// The preview canvas and every export run through the same renderCover, so what you
// see is what the PNG holds. A `?shot=` query sets up a fixed scene for a screenshot
// (./shots.js) instead of the empty studio.
import { renderCover, exportCover, SIZES } from './cover.js';
import { GRADES, gradeById } from './grades.js';
import { LAYOUTS, layoutById, panelRects } from './layouts.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const status = document.getElementById('status');
const titleInput = document.getElementById('title');
const subtitleInput = document.getElementById('subtitle');
const heatInput = document.getElementById('heat');
const heatStars = document.getElementById('heatStars');
const zoomInput = document.getElementById('zoom');
const panelLabel = document.getElementById('panelLabel');
const tray = document.getElementById('tray');

/** The whole editable state; photos hold image elements, panels hold their crops. */
const state = {
  layout: 'hero',
  grade: 'vice',
  size: 'square',
  title: 'NEON SHORE',
  subtitle: 'a Vice City story',
  heat: 4,
  grain: true,
  frame: true,
  photos: [],
  photoNames: [],
  selectedPhoto: 0,
  selectedPanel: 0,
  panels: [],
};

/** Undo history: snapshots of the state without the image elements. */
const history = { past: [], future: [] };

function blankPanels(layoutId) {
  return panelRects(layoutId).map(() => ({ photo: null, zoom: 1, ox: 0, oy: 0 }));
}

function resetPanels() {
  state.panels = blankPanels(state.layout);
  state.selectedPanel = 0;
}
resetPanels();

function snapshotState() {
  return JSON.stringify({
    layout: state.layout, grade: state.grade, size: state.size,
    title: state.title, subtitle: state.subtitle, heat: state.heat,
    grain: state.grain, frame: state.frame,
    selectedPhoto: state.selectedPhoto, selectedPanel: state.selectedPanel,
    panels: state.panels,
  });
}

function pushHistory() {
  history.past.push(snapshotState());
  if (history.past.length > 40) history.past.shift();
  history.future.length = 0;
  refreshUndoButtons();
}

function restoreSnapshot(json) {
  const data = JSON.parse(json);
  Object.assign(state, data);
  syncControls();
  redraw();
}

function undo() {
  if (!history.past.length) return;
  history.future.push(snapshotState());
  restoreSnapshot(history.past.pop());
  refreshUndoButtons();
}

function redo() {
  if (!history.future.length) return;
  history.past.push(snapshotState());
  restoreSnapshot(history.future.pop());
  refreshUndoButtons();
}

function refreshUndoButtons() {
  document.getElementById('undo').disabled = !history.past.length;
  document.getElementById('redo').disabled = !history.future.length;
}

function redraw() {
  const size = SIZES[state.size];
  if (canvas.width !== size.w || canvas.height !== size.h) {
    canvas.width = size.w;
    canvas.height = size.h;
  }
  renderCover(canvas, state);
  syncPanelTools();
}

function syncPanelTools() {
  const panel = state.panels[state.selectedPanel];
  panelLabel.textContent = `Panel ${state.selectedPanel + 1} of ${state.panels.length}`;
  zoomInput.value = String(panel?.zoom ?? 1);
  document.getElementById('clearPanel').disabled = !panel || panel.photo == null;
}

function syncControls() {
  titleInput.value = state.title;
  subtitleInput.value = state.subtitle;
  heatInput.value = String(state.heat);
  heatStars.textContent = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
  document.getElementById('grain').checked = state.grain;
  document.getElementById('frame').checked = state.frame;
  document.getElementById('size').value = state.size;
  document.querySelectorAll('#layouts button').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
    b.setAttribute('aria-pressed', String(b.dataset.layout === state.layout));
  });
  document.querySelectorAll('#grades button').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
    b.setAttribute('aria-pressed', String(b.dataset.grade === state.grade));
  });
  tray.querySelectorAll('img').forEach((img, i) => img.classList.toggle('selected', i === state.selectedPhoto));
}

/** Loads an image from a URL, resolving to the image once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/** Adds image elements to the tray and returns their indexes. */
export function addPhotos(images, names) {
  const start = state.photos.length;
  images.forEach((img, i) => {
    state.photos.push(img);
    state.photoNames.push(names[i] ?? `photo ${state.photos.length}`);
    const thumb = document.createElement('img');
    thumb.src = img.src;
    thumb.alt = state.photoNames[state.photos.length - 1];
    thumb.addEventListener('click', () => {
      state.selectedPhoto = state.photos.indexOf(img);
      syncControls();
    });
    tray.appendChild(thumb);
  });
  state.selectedPhoto = start;
  syncControls();
  return start;
}

/** Places the selected photo into a panel, keeping its crop centred. */
export function assignPhotoToPanel(panelIndex, photoIndex) {
  pushHistory();
  state.panels[panelIndex] = { photo: photoIndex, zoom: 1, ox: 0, oy: 0 };
  state.selectedPanel = panelIndex;
  redraw();
}

/** Clamps a panel's pan offsets so its photo still covers the panel. */
export function clampPan(panel, img, panelW, panelH) {
  if (!img) return;
  const scale = Math.max(panelW / img.naturalWidth, panelH / img.naturalHeight) * panel.zoom;
  const maxOx = Math.max(0, (img.naturalWidth * scale - panelW) / 2 / panelW);
  const maxOy = Math.max(0, (img.naturalHeight * scale - panelH) / 2 / panelH);
  panel.ox = Math.max(-maxOx, Math.min(maxOx, panel.ox));
  panel.oy = Math.max(-maxOy, Math.min(maxOy, panel.oy));
}

// --- Layout and grade pickers -------------------------------------------------

const layoutsEl = document.getElementById('layouts');
LAYOUTS.forEach((layout) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = layout.name;
  button.title = layout.blurb;
  button.dataset.layout = layout.id;
  button.addEventListener('click', () => {
    if (state.layout === layout.id) return;
    pushHistory();
    const old = state.panels;
    state.layout = layout.id;
    state.panels = blankPanels(layout.id);
    old.forEach((panel, i) => { if (i < state.panels.length) state.panels[i] = panel; });
    state.selectedPanel = 0;
    syncControls();
    redraw();
  });
  layoutsEl.appendChild(button);
});

const gradesEl = document.getElementById('grades');
GRADES.forEach((grade) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.dataset.grade = grade.id;
  const swatch = document.createElement('span');
  swatch.className = 'grade-swatch';
  swatch.style.background = grade.swatch;
  button.appendChild(swatch);
  button.appendChild(document.createTextNode(grade.name));
  button.addEventListener('click', () => {
    if (state.grade === grade.id) return;
    pushHistory();
    state.grade = grade.id;
    syncControls();
    redraw();
  });
  gradesEl.appendChild(button);
});

// --- Controls -----------------------------------------------------------------

document.getElementById('photo').addEventListener('change', async (e) => {
  const files = [...e.target.files];
  if (!files.length) return;
  pushHistory();
  const images = [];
  for (const file of files) images.push(await loadImage(URL.createObjectURL(file)));
  addPhotos(images, files.map((f) => f.name));
  if (state.panels.every((p) => p.photo == null) && state.photos.length) {
    state.panels.forEach((panel, i) => { panel.photo = i % state.photos.length; });
  }
  redraw();
  status.textContent = `${files.length} photo${files.length > 1 ? 's' : ''} added — click a panel to place one.`;
  e.target.value = '';
});

document.getElementById('fillAll').addEventListener('click', () => {
  if (!state.photos.length) { status.textContent = 'Add a photo first.'; return; }
  pushHistory();
  state.panels.forEach((panel) => { panel.photo = state.selectedPhoto; panel.zoom = 1; panel.ox = 0; panel.oy = 0; });
  redraw();
  status.textContent = 'Every panel now shows the selected photo.';
});

titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });
heatInput.addEventListener('input', () => {
  state.heat = Number(heatInput.value);
  heatStars.textContent = '★'.repeat(state.heat) + '☆'.repeat(5 - state.heat);
  redraw();
});
document.getElementById('grain').addEventListener('change', (e) => { pushHistory(); state.grain = e.target.checked; redraw(); });
document.getElementById('frame').addEventListener('change', (e) => { pushHistory(); state.frame = e.target.checked; redraw(); });
document.getElementById('size').addEventListener('change', (e) => { state.size = e.target.value; redraw(); });
document.getElementById('undo').addEventListener('click', undo);
document.getElementById('redo').addEventListener('click', redo);
document.getElementById('clearPanel').addEventListener('click', () => {
  pushHistory();
  state.panels[state.selectedPanel] = { photo: null, zoom: 1, ox: 0, oy: 0 };
  redraw();
});
zoomInput.addEventListener('input', () => {
  const panel = state.panels[state.selectedPanel];
  if (!panel) return;
  panel.zoom = Number(zoomInput.value);
  const rects = panelRects(state.layout);
  const img = panel.photo != null ? state.photos[panel.photo] : null;
  clampPan(panel, img, rects[state.selectedPanel].w * canvas.width, rects[state.selectedPanel].h * canvas.height);
  redraw();
});

// --- Drag to pan, click to select a panel -------------------------------------

function canvasPoint(event) {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * canvas.width,
    y: ((event.clientY - box.top) / box.height) * canvas.height,
  };
}

function panelAt(x, y) {
  const rects = panelRects(state.layout);
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x * canvas.width && x <= (r.x + r.w) * canvas.width
      && y >= r.y * canvas.height && y <= (r.y + r.h) * canvas.height) return i;
  }
  return -1;
}

let drag = null;
canvas.addEventListener('pointerdown', (event) => {
  const point = canvasPoint(event);
  const index = panelAt(point.x, point.y);
  if (index === -1) return;
  state.selectedPanel = index;
  canvas.setPointerCapture(event.pointerId);
  canvas.classList.add('dragging');
  drag = { x: point.x, y: point.y, moved: false };
  redraw();
});
canvas.addEventListener('pointermove', (event) => {
  if (!drag) return;
  const point = canvasPoint(event);
  const panel = state.panels[state.selectedPanel];
  const img = panel?.photo != null ? state.photos[panel.photo] : null;
  if (panel && img) {
    const rect = panelRects(state.layout)[state.selectedPanel];
    panel.ox += (point.x - drag.x) / (rect.w * canvas.width);
    panel.oy += (point.y - drag.y) / (rect.h * canvas.height);
    clampPan(panel, img, rect.w * canvas.width, rect.h * canvas.height);
    drag.moved = true;
    redraw();
  }
  drag.x = point.x;
  drag.y = point.y;
});
canvas.addEventListener('pointerup', (event) => {
  if (drag?.moved) pushHistory();
  drag = null;
  canvas.classList.remove('dragging');
  if (event.pointerType === 'mouse' && event.detail === 2) {
    // Double-click a panel: place the selected photo into it.
    const point = canvasPoint(event);
    const index = panelAt(point.x, point.y);
    if (index >= 0 && state.photos.length) assignPhotoToPanel(index, state.selectedPhoto);
  }
});

// --- Export -------------------------------------------------------------------

function downloadCanvas(exportCanvas, name) {
  exportCanvas.toBlob((blob) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }, 'image/png');
}

/** Exports the current size; also used by the screenshot scenes. */
export function exportCurrentSize() {
  const out = exportCover(state, state.size);
  const size = SIZES[state.size];
  downloadCanvas(out, `vice-city-cover-${size.w}x${size.h}.png`);
  status.textContent = `Saved vice-city-cover-${size.w}x${size.h}.png`;
}

document.getElementById('export').addEventListener('click', exportCurrentSize);
document.getElementById('exportSize').addEventListener('click', exportCurrentSize);
document.getElementById('exportAll').addEventListener('click', () => {
  Object.keys(SIZES).forEach((sizeId, i) => {
    setTimeout(() => {
      const out = exportCover(state, sizeId);
      const size = SIZES[sizeId];
      downloadCanvas(out, `vice-city-cover-${size.w}x${size.h}.png`);
    }, i * 350);
  });
  status.textContent = 'Saved all 3 sizes: 1080×1080, 1080×1350 and 1920×1080.';
});

// --- Boot ---------------------------------------------------------------------

/** Frames a shot scene's panel on the top of its photo, where faces usually are. */
export function topFocusCrop(panel, img, panelW, panelH) {
  if (!img) return;
  const scale = Math.max(panelW / img.naturalWidth, panelH / img.naturalHeight) * (panel.zoom || 1);
  const maxOy = Math.max(0, (img.naturalHeight * scale - panelH) / 2 / panelH);
  panel.oy = maxOy * 0.75;
  panel.ox = 0;
}

const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), async (scene) => {
    const first = await loadImage(scene.photo);
    const second = await loadImage(scene.secondPhoto);
    addPhotos([first, second], ['sample 1', 'sample 2']);
    state.title = scene.title;
    state.subtitle = scene.subtitle;
    state.layout = layoutById(scene.layout).id;
    state.grade = gradeById(scene.grade).id;
    state.size = SIZES[scene.size] ? scene.size : 'square';
    state.heat = scene.heat;
    state.panels = blankPanels(state.layout);
    state.panels.forEach((panel, i) => { panel.photo = i % 2; });
    if (state.layout === 'bleed') state.panels[0].photo = 0;
    // Frame every panel on the top of its photo so the shot shows faces, not torsos.
    // Size the canvas first: the crop math needs the scene's true aspect ratio.
    const sceneSize = SIZES[state.size];
    canvas.width = sceneSize.w;
    canvas.height = sceneSize.h;
    const rects = panelRects(state.layout);
    state.panels.forEach((panel, i) => {
      topFocusCrop(panel, panel.photo != null ? state.photos[panel.photo] : null, rects[i].w * canvas.width, rects[i].h * canvas.height);
    });
    syncControls();
    redraw();
  });
} else {
  document.fonts.load('16px Anton').then(redraw);
  document.fonts.load('16px Pacifico').then(redraw);
  syncControls();
  refreshUndoButtons();
  redraw();
}
