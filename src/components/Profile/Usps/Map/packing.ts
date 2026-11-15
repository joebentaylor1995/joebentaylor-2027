// Imports
// ------------
import type { GlobeGeometry } from './geometry';

// Constants
// ------------
// NOTE • Why: the globe's vertex buffers are built once, at build time (scripts/build-globe.ts), and
// shipped packed. Packing is lossless: unpack() returns the very same Float32 bits. Raw floats barely
// compress, so each layer is stored as what deflate can squeeze:
//   - a line layer repeats most vertices (a segment usually starts where the last one ended), so each
//     segment keeps one flag byte and only its new vertices
//   - x and y are stored as the difference from the previous vertex, and z as the difference from the
//     z that x and y imply on the unit sphere, so most stored numbers are small
//   - the numbers are split into four byte planes, which puts the (mostly zero) high bytes together
// The file is those bytes deflated; the browser inflates them with DecompressionStream.
const FORMAT = 1;

// NOTE • The format is part of the file name, so a browser's cached copy of an older layout is never
// handed to newer code (static files are cached, see next.config.js)
export const GEOMETRY_URL = `/data/globe/geometry.v${FORMAT}.bin`;

const LAYERS = ['outlines', 'grid', 'dots'] as const;
// Line layers hold segments (two vertices each); the dots layer holds single vertices
const LINE_LAYERS: ReadonlySet<string> = new Set(['outlines', 'grid']);

const COMPONENTS = 3;
const SEGMENT_FLOATS = COMPONENTS * 2;
const BYTE_PLANES = 4;
const HEADER_WORDS = 1 + LAYERS.length * 2;

// Helpers
// ------------
// One float's bits, read and written through a shared buffer
const float = new Float32Array(1);
const bits = new Uint32Array(float.buffer);

// Float bits reordered so they count upwards with the float's value, which keeps the difference
// between two nearby floats small (raw bits count downwards for negatives)
const ordered = (raw: number) => (raw & 0x80000000 ? ~raw : raw | 0x80000000) >>> 0;
const unordered = (value: number) => (value & 0x80000000 ? value & 0x7fffffff : ~value) >>> 0;

// Signed difference folded into an unsigned number, small either side of zero
const fold = (difference: number) => ((difference << 1) ^ (difference >> 31)) >>> 0;
const unfold = (value: number) => (value >>> 1) ^ -(value & 1);

// The z a unit-sphere vertex should have given its x and y (as ordered bits), on the side of the
// sphere the previous vertex was on. Only exactly-rounded maths, so every engine agrees on it.
function impliedZ(x: number, y: number, previousZ: number) {
	const magnitude = Math.sqrt(Math.max(0, 1 - x * x - y * y));
	float[0] = previousZ < 0 ? -magnitude : magnitude;
	return ordered(bits[0]);
}

// Drops the vertices a line layer repeats: flags[i] is 1 when segment i starts where segment i - 1
// ended, and then only its end vertex is kept
function joinSegments(layer: Uint32Array) {
	const flags = new Uint8Array(layer.length / SEGMENT_FLOATS);
	const vertices: number[] = [];
	for (let start = 0; start < layer.length; start += SEGMENT_FLOATS) {
		const end = start + COMPONENTS;
		const isJoined =
			start > 0 &&
			layer[start] === layer[start - 3] &&
			layer[start + 1] === layer[start - 2] &&
			layer[start + 2] === layer[start - 1];
		flags[start / SEGMENT_FLOATS] = isJoined ? 1 : 0;
		if (!isJoined) vertices.push(layer[start], layer[start + 1], layer[start + 2]);
		vertices.push(layer[end], layer[end + 1], layer[end + 2]);
	}
	return { flags, vertices: new Uint32Array(vertices) };
}

// The reverse: every segment gets both of its vertices back
function splitSegments(flags: Uint8Array, vertices: Uint32Array) {
	const layer = new Uint32Array(flags.length * SEGMENT_FLOATS);
	let next = 0;
	for (let segment = 0; segment < flags.length; segment++) {
		const start = segment * SEGMENT_FLOATS;
		// A joined segment starts with the previous segment's end; everything else was kept
		const kept = flags[segment] ? COMPONENTS : SEGMENT_FLOATS;
		if (flags[segment]) layer.copyWithin(start, start - COMPONENTS, start);
		for (let i = SEGMENT_FLOATS - kept; i < SEGMENT_FLOATS; i++) layer[start + i] = vertices[next++];
	}
	return layer;
}

// Vertices (float bits) to byte planes of small numbers: all x differences, then y, then z
function shrinkVertices(vertices: Uint32Array) {
	const total = vertices.length;
	const count = total / COMPONENTS;
	const stored = new Uint32Array(total);
	let previousX = 0;
	let previousY = 0;
	let previousZ = 0;
	for (let vertex = 0; vertex < count; vertex++) {
		const at = vertex * COMPONENTS;
		const orderedX = ordered(vertices[at]);
		const orderedY = ordered(vertices[at + 1]);
		bits[0] = vertices[at];
		const x = float[0];
		bits[0] = vertices[at + 1];
		const y = float[0];
		stored[vertex] = fold((orderedX - previousX) | 0);
		stored[count + vertex] = fold((orderedY - previousY) | 0);
		stored[count * 2 + vertex] = fold((ordered(vertices[at + 2]) - impliedZ(x, y, previousZ)) | 0);
		previousX = orderedX;
		previousY = orderedY;
		bits[0] = vertices[at + 2];
		previousZ = float[0];
	}
	const planes = new Uint8Array(total * BYTE_PLANES);
	for (let plane = 0; plane < BYTE_PLANES; plane++)
		for (let i = 0; i < total; i++) planes[plane * total + i] = stored[i] >>> (plane * 8);
	return planes;
}

// The reverse: byte planes back to the original float bits
function restoreVertices(planes: Uint8Array) {
	const total = planes.length / BYTE_PLANES;
	const count = total / COMPONENTS;
	const stored = new Uint32Array(total);
	for (let plane = 0; plane < BYTE_PLANES; plane++)
		for (let i = 0; i < total; i++) stored[i] |= planes[plane * total + i] << (plane * 8);
	const vertices = new Uint32Array(total);
	let previousX = 0;
	let previousY = 0;
	let previousZ = 0;
	for (let vertex = 0; vertex < count; vertex++) {
		const at = vertex * COMPONENTS;
		previousX = (previousX + unfold(stored[vertex])) >>> 0;
		previousY = (previousY + unfold(stored[count + vertex])) >>> 0;
		vertices[at] = unordered(previousX);
		vertices[at + 1] = unordered(previousY);
		bits[0] = vertices[at];
		const x = float[0];
		bits[0] = vertices[at + 1];
		const y = float[0];
		vertices[at + 2] = unordered((impliedZ(x, y, previousZ) + unfold(stored[count * 2 + vertex])) >>> 0);
		bits[0] = vertices[at + 2];
		previousZ = float[0];
	}
	return vertices;
}

// Exports
// ------------
// Packs the three vertex buffers into the bytes that get deflated into the geometry file:
// a header (format, then segment and vertex counts per layer), then each layer's flags and planes
export function pack(geometry: GlobeGeometry): Uint8Array {
	const header = new DataView(new ArrayBuffer(HEADER_WORDS * 4));
	header.setUint32(0, FORMAT, true);
	const parts: Uint8Array[] = [new Uint8Array(header.buffer)];
	LAYERS.forEach((name, index) => {
		const layer = new Uint32Array(geometry[name].buffer, geometry[name].byteOffset, geometry[name].length);
		const { flags, vertices } = LINE_LAYERS.has(name)
			? joinSegments(layer)
			: { flags: new Uint8Array(0), vertices: layer };
		header.setUint32((1 + index * 2) * 4, flags.length, true);
		header.setUint32((2 + index * 2) * 4, vertices.length / COMPONENTS, true);
		parts.push(flags, shrinkVertices(vertices));
	});
	const packed = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
	let offset = 0;
	for (const part of parts) {
		packed.set(part, offset);
		offset += part.length;
	}
	return packed;
}

// Rebuilds the three vertex buffers, bit for bit, from the inflated geometry file
export function unpack(packed: Uint8Array): GlobeGeometry {
	const header = new DataView(packed.buffer, packed.byteOffset, packed.byteLength);
	if (packed.length < HEADER_WORDS * 4 || header.getUint32(0, true) !== FORMAT)
		throw new Error('Globe geometry is in an unknown format');
	let offset = HEADER_WORDS * 4;
	const take = (length: number) => {
		if (offset + length > packed.length) throw new Error('Globe geometry is incomplete');
		offset += length;
		return packed.subarray(offset - length, offset);
	};
	const [outlines, grid, dots] = LAYERS.map((name, index) => {
		const flags = take(header.getUint32((1 + index * 2) * 4, true));
		const vertexCount = header.getUint32((2 + index * 2) * 4, true);
		const vertices = restoreVertices(take(vertexCount * COMPONENTS * BYTE_PLANES));
		const layer = LINE_LAYERS.has(name) ? splitSegments(flags, vertices) : vertices;
		return new Float32Array(layer.buffer);
	});
	return { outlines, grid, dots };
}
