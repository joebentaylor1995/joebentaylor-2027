// Shared parts of the digital-rain scenes (the 404 page and the Connect portrait): the particle
// layout, tap ripples, press-and-hold charge and pointer easing. Each engine keeps its own programs,
// look and lifecycle.

// Constants
// ------------
// Press-and-hold time (seconds) at which a tap becomes a full charge that bursts the scene
export const RAIN_CHARGE_SECONDS = 0.7;

// Burst timeline in seconds since the click: when the glyphs start re-forming, and when the cycle is over
export const RAIN_RETURN_START = 4.5;
export const RAIN_CYCLE_END = 7.6;

// Longest step a frame may advance the motion by
export const RAIN_MAX_FRAME_SECONDS = 0.05;

// Look settings both scenes use unchanged
export const RAIN_LOOK = { fade: 0.5, angle: 0, reach: 120, ripple: 0.3 };

// How far a full charge (1) pushes each look setting
export const RAIN_CHARGE_BOOST = { glow: 0.55, depth: 0.18, portraitScale: 0.07, detail: 0.25, magnet: 1.8 };

// One oversized clip-space triangle covers the screen for the backdrop
export const RAIN_BACKDROP_VERTICES = new Float32Array([-1, -1, 3, -1, -1, 3]);

// Width and height of the square glyph atlas
export const RAIN_ATLAS_SIZE = 512;

// Uniform names (u_<name> in the shaders)
const UNIFORM_NAMES = [
	'resolution',
	'time',
	'dpr',
	'pass',
	'atlas',
	'size',
	'brightness',
	'glow',
	'fade',
	'portrait',
	'face',
	'portraitSize',
	'aspect',
	'depth',
	'bend',
	'angle',
	'cursor',
	'tilt',
	'magnet',
	'reach',
	'ripple',
	'waves[0]',
	'burst',
	'chargeDetail',
	'chargeWave',
];

// Atlas grid: 8x8 cells of 64px; the text baseline sits 1px below the cell's centre
const ATLAS_COLUMNS = 8;
const ATLAS_CELL = 64;
const ATLAS_CELL_CENTRE = 32;
const ATLAS_CELL_TEXT_Y = 33;
const GLYPH_COUNT = ATLAS_COLUMNS * ATLAS_COLUMNS;

// Seeded generator (Lehmer) so the rain layout is the same after every resize
const LAYOUT_SEED = 17;
const LEHMER_MULTIPLIER = 16807;
const LEHMER_MODULUS = 2147483647;

// Layout, before the scene's glyph scale: spacing of columns (nearest layer, then the others) and rows
const NEAR_COLUMN_SPACING = 32;
const FAR_COLUMN_SPACING = 25;
const ROW_SPACING = 24;
const FIRST_COLUMN_X = 8;

// Glyphs wrap over the screen height plus this margin; the vertex shader wraps with the same value
const WRAP_MARGIN = 160;

// Per depth layer, nearest last: point size and brightness multiplier
const LAYER_POINT_SIZES = [15, 19, 23];
const LAYER_BRIGHTNESS = [0.28, 0.56, 1];
const LAYER_X_SHIFT = 7;

// Per column: fall speed (px/s) and streak and gap lengths (cells)
const MIN_FALL_SPEED = 35;
const FALL_SPEED_RANGE = 65;
const LAYER_FALL_SPEED = 24;
const MIN_STREAK = 8;
const STREAK_RANGE = 20;
const MIN_GAP = 8;
const GAP_RANGE = 14;

// Brightness along a streak, rising towards its head
const STREAK_BASE_LIGHT = 0.13;
const STREAK_HEAD_LIGHT = 0.85;
const STREAK_LIGHT_CURVE = 1.6;

// Per glyph: x, y, speed, glyph index, size, brightness (a_drop then a_style)
const FLOATS_PER_GLYPH = 6;

// Ripple ring: age (seconds) a ripple rests at, and the strength of the shortest tap
const RIPPLE_COUNT = 4;
const RIPPLE_REST_AGE = 10;
const RIPPLE_BASE_AMPLITUDE = 1.3;

// Charge easing rates, while holding and after letting go
const CHARGE_RISE_RATE = 18;
const CHARGE_FALL_RATE = 5;

// Strength of the inward charge pulse, at no charge and added at full charge
const CHARGE_WAVE_BASE = 0.2;
const CHARGE_WAVE_GAIN = 0.55;

const CURSOR_EASE_RATE = 9;

// Glow pass, then crisp glyph pass (u_pass)
const GLOW_PASS = 1;
const GLYPH_PASS = 0;

// Types
// ------------
// x/y ease towards the target tx/ty; active eases towards target (0 or 1)
export interface RainCursor {
	x: number;
	y: number;
	tx: number;
	ty: number;
	active: number;
	target: number;
}

// Ring of the latest tap ripples; packed holds them as (x, y, age, amplitude) for u_waves
export interface RainRipples {
	waves: { x: number; y: number; age: number; amplitude: number }[];
	packed: Float32Array;
	next: number;
}

// Helpers
// ------------
// Three depth layers of columns, each a dashed stream of glyphs that brightens towards its head.
// glyphScale is the scene's point size factor; columnDensity packs the columns closer together.
function buildRainGlyphs(width: number, height: number, glyphScale: number, columnDensity: number) {
	let seed = LAYOUT_SEED;
	const random = () => {
		seed = (seed * LEHMER_MULTIPLIER) % LEHMER_MODULUS;
		return (seed - 1) / (LEHMER_MODULUS - 1);
	};

	const rowSpacing = ROW_SPACING * glyphScale;
	const wrapHeight = height + WRAP_MARGIN;
	const rows = Math.ceil(wrapHeight / rowSpacing);
	const spacings = LAYER_POINT_SIZES.map(
		(_, layer) => ((layer === 0 ? NEAR_COLUMN_SPACING : FAR_COLUMN_SPACING) * glyphScale) / columnDensity
	);

	// NOTE • Why: the layout used to be pushed into a number[] (hundreds of thousands of entries
	// at full screen) and then copied into a Float32Array. Writing the same values straight into
	// a Float32Array stores the same float32s without the intermediate array. Sized for every
	// cell (gaps leave some unused), and grown if the column estimate ever falls short.
	let data = new Float32Array(
		spacings.reduce(
			(cells, spacing) => cells + (Math.ceil((width + spacing - FIRST_COLUMN_X) / spacing) + 1) * rows,
			0
		) * FLOATS_PER_GLYPH
	);
	let length = 0;

	for (let layer = 0; layer < LAYER_POINT_SIZES.length; layer++) {
		const spacing = spacings[layer];
		for (let x = FIRST_COLUMN_X; x < width + spacing; x += spacing) {
			// Per column: start offset, fall speed, streak length and gap between streaks
			const offset = random() * wrapHeight;
			const velocity = MIN_FALL_SPEED + random() * FALL_SPEED_RANGE + layer * LAYER_FALL_SPEED;
			const streak = MIN_STREAK + Math.floor(random() * STREAK_RANGE);
			const gap = MIN_GAP + Math.floor(random() * GAP_RANGE);

			for (let j = 0; j < rows; j++) {
				const phase = j % (streak + gap);
				// Gap cells emit nothing
				if (phase >= streak) continue;
				if (length + FLOATS_PER_GLYPH > data.length) {
					const grown = new Float32Array(Math.max(data.length * 2, FLOATS_PER_GLYPH));
					grown.set(data);
					data = grown;
				}
				data[length++] = x + (layer - 1) * LAYER_X_SHIFT;
				data[length++] = (offset + j * rowSpacing) % wrapHeight;
				data[length++] = velocity;
				data[length++] = Math.floor(random() * GLYPH_COUNT);
				data[length++] = LAYER_POINT_SIZES[layer];
				data[length++] =
					(STREAK_BASE_LIGHT + STREAK_HEAD_LIGHT * (phase / streak) ** STREAK_LIGHT_CURVE) *
					LAYER_BRIGHTNESS[layer];
			}
		}
	}

	return data.subarray(0, length);
}

// Exports
// ------------
// Looks up the uniforms both scenes share, then any of the scene's own, keyed by their bare name
export function lookupRainUniforms(gl: WebGLRenderingContext, program: WebGLProgram, extraNames: string[] = []) {
	const uniforms: Record<string, WebGLUniformLocation | null> = {};
	for (const name of [...UNIFORM_NAMES, ...extraNames]) uniforms[name] = gl.getUniformLocation(program, `u_${name}`);
	return uniforms;
}

// Regenerates the rain into the given buffer and returns how many glyphs to draw
export function uploadRainGlyphs(
	gl: WebGLRenderingContext,
	buffer: WebGLBuffer,
	width: number,
	height: number,
	glyphScale: number,
	columnDensity: number
) {
	const data = buildRainGlyphs(width, height, glyphScale, columnDensity);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
	return data.length / FLOATS_PER_GLYPH;
}

// Writes the glyphs into the atlas grid, repeating them to fill every cell
export function fillGlyphGrid(ink: CanvasRenderingContext2D, glyphs: string[]) {
	for (let i = 0; i < GLYPH_COUNT; i++)
		ink.fillText(
			glyphs[i % glyphs.length],
			(i % ATLAS_COLUMNS) * ATLAS_CELL + ATLAS_CELL_CENTRE,
			Math.floor(i / ATLAS_COLUMNS) * ATLAS_CELL + ATLAS_CELL_TEXT_Y
		);
}

// Draws the backdrop triangle with its program already bound
export function drawRainBackdrop(gl: WebGLRenderingContext, buffer: WebGLBuffer, position: number) {
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	gl.drawArrays(gl.TRIANGLES, 0, 3);
	gl.disableVertexAttribArray(position);
}

// Draws the glyphs twice: a large soft glow pass, then the crisp glyphs
export function drawRainPasses(gl: WebGLRenderingContext, passUniform: WebGLUniformLocation | null, count: number) {
	gl.uniform1f(passUniform, GLOW_PASS);
	gl.drawArrays(gl.POINTS, 0, count);
	gl.uniform1f(passUniform, GLYPH_PASS);
	gl.drawArrays(gl.POINTS, 0, count);
}

export const createRainCursor = (): RainCursor => ({ x: 0, y: 0, tx: 0, ty: 0, active: 0, target: 0 });

// Points the cursor's target at the event, in canvas pixels
export function aimRainCursor(canvas: HTMLCanvasElement, cursor: RainCursor, event: PointerEvent) {
	const rect = canvas.getBoundingClientRect();
	cursor.tx = event.clientX - rect.left;
	cursor.ty = event.clientY - rect.top;
}

// Frame-rate independent easing of the cursor and its influence
export function easeRainCursor(cursor: RainCursor, dt: number) {
	const ease = 1 - Math.exp(-dt * CURSOR_EASE_RATE);
	cursor.x += (cursor.tx - cursor.x) * ease;
	cursor.y += (cursor.ty - cursor.y) * ease;
	cursor.active += (cursor.target - cursor.active) * ease;
}

export const createRainRipples = (): RainRipples => ({
	waves: Array.from({ length: RIPPLE_COUNT }, () => ({ x: 0, y: 0, age: RIPPLE_REST_AGE, amplitude: 0 })),
	packed: new Float32Array(RIPPLE_COUNT * 4),
	next: 0,
});

// Replaces the oldest ripple; a longer press makes a stronger one
export function dropRainRipple(ripples: RainRipples, x: number, y: number, heldSeconds: number) {
	ripples.waves[ripples.next] = { x, y, age: 0, amplitude: RIPPLE_BASE_AMPLITUDE + heldSeconds };
	ripples.next = (ripples.next + 1) % ripples.waves.length;
}

export function silenceRainRipples(ripples: RainRipples) {
	for (const wave of ripples.waves) wave.amplitude = 0;
}

export function ageRainRipples(ripples: RainRipples, dt: number) {
	for (const wave of ripples.waves) wave.age = Math.min(RIPPLE_REST_AGE, wave.age + dt);
}

// Refreshes and returns the packed ripple data
export function packRainRipples({ waves, packed }: RainRipples) {
	for (let i = 0; i < waves.length; i++) {
		const wave = waves[i];
		packed[i * 4] = wave.x;
		packed[i * 4 + 1] = wave.y;
		packed[i * 4 + 2] = wave.age;
		packed[i * 4 + 3] = wave.amplitude;
	}
	return packed;
}

// One easing step of the charge amount (0..1), which rises with the time held and falls after letting go
export const easeRainCharge = (amount: number, holding: boolean, heldSeconds: number, dt: number) =>
	amount +
	((holding ? Math.min(1, heldSeconds / RAIN_CHARGE_SECONDS) : 0) - amount) *
		(1 - Math.exp(-dt * (holding ? CHARGE_RISE_RATE : CHARGE_FALL_RATE)));

// Strength of the inward pulse while holding
export const rainChargeWave = (holding: boolean, amount: number) =>
	holding ? CHARGE_WAVE_BASE + amount * CHARGE_WAVE_GAIN : 0;
