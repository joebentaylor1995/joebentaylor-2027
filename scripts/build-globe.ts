// Property Documentation
// ------------

// NOTE • Bakes the profile globe's vertex buffers, so the browser downloads them ready-made
// instead of fetching 3MB of GeoJSON and rebuilding them on every page load:
//   scripts/data/globe/countries.geojson → public/data/globe/geometry.v<format>.bin
// The buffers come from the same code the browser used to run (Map/geometry.ts) and are packed
// without loss (Map/packing.ts), then deflated.
// Runs before dev/build. `--check` exits non-zero when the shipped file no longer matches what
// the source data and geometry code produce (used by the pre-commit hook and CI) without
// writing anything.

// Imports
// ------------
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { buildGeometry, type GlobeGeometry } from '../src/components/Profile/Usps/Map/geometry';
import { GEOMETRY_URL, pack, unpack } from '../src/components/Profile/Usps/Map/packing';

// Constants
// ------------
const ROOT = path.resolve(import.meta.dir, '..');
const IS_CHECK = process.argv.includes('--check');
const SOURCE = 'scripts/data/globe/countries.geojson';
const TARGET = path.join('public', GEOMETRY_URL);
const MAX_COMPRESSION = 9;
const LAYERS = ['outlines', 'grid', 'dots'] as const;

// Helpers
// ------------
const bytes = (layer: Float32Array) => Buffer.from(layer.buffer, layer.byteOffset, layer.byteLength);

// Bit for bit, so -0 and 0 count as different
const isSameGeometry = (a: GlobeGeometry, b: GlobeGeometry) =>
	LAYERS.every(layer => bytes(a[layer]).equals(bytes(b[layer])));

// The geometry in the shipped file, or null when there is no readable one
const readShipped = () => {
	try {
		return unpack(inflateRawSync(readFileSync(path.join(ROOT, TARGET))));
	} catch {
		return null;
	}
};

// Run
// ------------
const geometry = buildGeometry(JSON.parse(readFileSync(path.join(ROOT, SOURCE), 'utf8')));
const packed = pack(geometry);

// NOTE • Guards the packing itself: a file that does not unpack to the same bits must never ship
if (!isSameGeometry(geometry, unpack(packed))) throw new Error('Globe geometry does not survive packing');

// NOTE • Compares what the file unpacks to rather than its bytes, so a zlib that deflates
// differently on another machine does not make an up-to-date file look stale
const shipped = readShipped();
const isStale = !shipped || !isSameGeometry(geometry, shipped);

if (IS_CHECK && isStale) {
	console.error(`Generated globe geometry is stale: ${TARGET}\nRun \`bun run globe\`.`);
	process.exit(1);
}

if (!IS_CHECK && isStale) writeFileSync(path.join(ROOT, TARGET), deflateRawSync(packed, { level: MAX_COMPRESSION }));
if (!IS_CHECK) console.log(isStale ? `Generated ${TARGET}` : 'Globe geometry up to date');
