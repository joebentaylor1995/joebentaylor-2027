// Constants
// ------------
// NOTE • Why: the face is only ever read as a 512px-wide height map, so the site ships that map
// (baked by scripts/build-portrait.ts) rather than the full-size photo. The file is the map itself,
// stored without loss: drawn at its own size and passed through the portrait worker it comes out
// unchanged, so the scene uploads the same pixels the photo used to produce.
export const PORTRAIT_URL = '/images/connect/face.webp';
export const PORTRAIT_MAP_WIDTH = 512;

// The photo the map is baked from (scripts/data/portrait/face.png). The scene keeps the photo's
// proportions; the map's own differ slightly, because its height is rounded to whole pixels.
export const PORTRAIT_SOURCE_SIZE = { width: 775, height: 1193 };
