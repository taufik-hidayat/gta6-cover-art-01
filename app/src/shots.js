// Fixed scenes for screenshots: ?shot=editor shows the app with sample photos loaded,
// ?shot=cover shows the cover alone, drawn at the export size the query names.
// `photo` picks the sample (samples/<photo>.jpg), `caption` the title, `layout` and
// `grade` the look, `size` the export size. window.__shotReady is set once painted.
export async function runShot(shot, query, load) {
  if (shot === 'cover') document.body.classList.add('shot-cover');
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const subtitle = query.get('subtitle') ?? 'a Vice City story';
  await load({
    photo: `samples/${photo}.jpg`,
    secondPhoto: `samples/${photo === 'pier' ? 'boulevard' : 'pier'}.jpg`,
    title: caption,
    subtitle,
    layout: query.get('layout') ?? 'hero',
    grade: query.get('grade') ?? 'vice',
    size: query.get('size') ?? 'square',
    heat: Number(query.get('heat') ?? 4),
  });
  await document.fonts.ready;
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
