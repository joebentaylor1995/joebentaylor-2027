// Imports
// ------------
import { getSettings, getSettingsTarget, subscribe } from '@parts/ProfileReveal/Settings/store';
import { canHover } from '@utils/desktopHover';
import {
	ageRainRipples,
	aimRainCursor,
	createRainCursor,
	createRainRipples,
	drawRainBackdrop,
	drawRainPasses,
	dropRainRipple,
	easeRainCharge,
	easeRainCursor,
	fillGlyphGrid,
	lookupRainUniforms,
	packRainRipples,
	RAIN_ATLAS_SIZE,
	RAIN_BACKDROP_VERTICES,
	RAIN_CHARGE_BOOST,
	RAIN_CHARGE_SECONDS,
	RAIN_CYCLE_END,
	RAIN_LOOK,
	RAIN_MAX_FRAME_SECONDS,
	RAIN_RETURN_START,
	rainChargeWave,
	silenceRainRipples,
	uploadRainGlyphs,
} from '@utils/digitalRain';
import { setClampedLinear } from '@utils/webgl';
import gsap from 'gsap';
import type { MatrixScene } from './interface';
import { fragmentShader, vertexShader } from './shaders';

// Constants
// ------------
// Vertical gradient backdrop, from near-black at the top to blue at the bottom
const BACKDROP_VERTEX =
	'attribute vec2 position; varying vec2 uv; void main(){uv=position*0.5+0.5;gl_Position=vec4(position,0.0,1.0);}';
const BACKDROP_FRAGMENT =
	'precision mediump float; varying vec2 uv; void main(){gl_FragColor=vec4(mix(vec3(18.0)/255.0,vec3(22.0,83.0,255.0)/255.0,1.0-uv.y),1.0);}';

const UNIT_ATLAS = 0;
const UNIT_PORTRAIT = 1;

const ATLAS_NAME = 'JOE BEN TAYLOR';
const PORTRAIT_URL = '/images/connect/face.png';
const PORTRAIT_MAP_WIDTH = 512;

const GLYPH_SCALE = 9 / 23;

// Columns packed closer together than the base spacing
const COLUMN_DENSITY = 1.4;
const MAX_PIXEL_RATIO = 1.5;

// Portrait size on mobile unless the settings ask for a small face
const MOBILE_PORTRAIT_SIZE = 1.45;

// Pointer pull at full hover
const CURSOR_MAGNET = 0.9;

// Burst screen shake (exposed to CSS), in px: strength, decay and attack over the burst's age, and wobble frequencies
const SHAKE_PX = 8;
const SHAKE_DECAY = 2;
const SHAKE_ATTACK = 25;
const SHAKE_FREQUENCY_X = 61;
const SHAKE_FREQUENCY_Y = 83;
const SHAKE_Y_RATIO = 0.65;

// Helpers
// ------------
// Unwraps a GL resource, throwing if the browser could not allocate it
function required<T>(value: T | null): T {
	if (!value) throw new Error('Matrix resource unavailable');
	return value;
}

// Compiles and links the rain program; on a compile failure it frees what it made and throws
function linkRainProgram(gl: WebGLRenderingContext, shaders: WebGLShader[]) {
	const program = required(gl.createProgram());
	for (const [kind, source] of [
		[gl.VERTEX_SHADER, vertexShader],
		[gl.FRAGMENT_SHADER, fragmentShader],
	] as const) {
		const shader = required(gl.createShader(kind));
		shaders.push(shader);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			for (const item of shaders) gl.deleteShader(item);
			gl.deleteProgram(program);
			throw new Error('Matrix shader could not compile');
		}
		gl.attachShader(program, shader);
	}

	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Matrix program could not link');
	return program;
}

function linkBackdropProgram(gl: WebGLRenderingContext, shaders: WebGLShader[]) {
	const program = required(gl.createProgram());
	for (const [kind, source] of [
		[gl.VERTEX_SHADER, BACKDROP_VERTEX],
		[gl.FRAGMENT_SHADER, BACKDROP_FRAGMENT],
	] as const) {
		const shader = required(gl.createShader(kind));
		shaders.push(shader);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		gl.attachShader(program, shader);
	}

	gl.linkProgram(program);
	return program;
}

// Glyph atlas: the letters of the name, repeated to fill the grid
function drawNameAtlas() {
	const atlas = document.createElement('canvas');
	atlas.width = atlas.height = RAIN_ATLAS_SIZE;
	const ink = required(atlas.getContext('2d'));
	ink.fillStyle = 'white';
	ink.font = '42px monospace';
	ink.textAlign = 'center';
	ink.textBaseline = 'middle';
	fillGlyphGrid(
		ink,
		Array.from(ATLAS_NAME).filter(letter => letter !== ' ')
	);
	return atlas;
}

const portraitSizeSetting = (settings: ReturnType<typeof getSettings>) => {
	if (getSettingsTarget() !== 'mobile') return settings.matrixPortraitSize;
	return settings.mobileFaceSmall ? settings.mobileFaceSize : MOBILE_PORTRAIT_SIZE;
};

// Engine
// ------------
// Draws the Connect section's digital-rain portrait. Each glyph is a GL point; the vertex shader lifts
// them over a greyscale height map of the face (built in a worker from /images/connect/face.png).
// Hover pulls glyphs towards the cursor, a tap sends a ripple, and a long press charges then bursts
// the portrait, which re-forms after RAIN_CYCLE_END seconds. section.dataset.state/matrixPhase mirror the lifecycle.
export function createMatrix(canvas: HTMLCanvasElement, section: HTMLElement): MatrixScene {
	// Programs
	const gl = required(canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' }));
	const shaders: WebGLShader[] = [];
	const program = linkRainProgram(gl, shaders);
	// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
	gl.useProgram(program);

	const uniforms = lookupRainUniforms(gl, program);
	const scalar = (name: string, value: number) => gl.uniform1f(uniforms[name], value);

	const backgroundProgram = linkBackdropProgram(gl, shaders);
	const backgroundPosition = gl.getAttribLocation(backgroundProgram, 'position');
	const backgroundBuffer = required(gl.createBuffer());
	gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, RAIN_BACKDROP_VERTICES, gl.STATIC_DRAW);

	// Particle buffer, 24-byte stride: a_drop (x, y, speed, glyph index) then a_style (size, brightness)
	const buffer = required(gl.createBuffer());
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	const attributes = [
		[gl.getAttribLocation(program, 'a_drop'), 4, 0],
		[gl.getAttribLocation(program, 'a_style'), 2, 16],
	] as const;
	const enableRainAttributes = () => {
		for (const [attribute, size, offset] of attributes) {
			gl.enableVertexAttribArray(attribute);
			gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 24, offset);
		}
	};
	enableRainAttributes();

	// Textures
	const textures: WebGLTexture[] = [];

	// Creates a clamped linear texture on a unit and binds its sampler uniform; without a source it is a 1px black placeholder
	function texture(unit: number, name: string, source?: HTMLCanvasElement) {
		const item = required(gl.createTexture());
		textures.push(item);
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, item);
		if (source) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
		else
			gl.texImage2D(
				gl.TEXTURE_2D,
				0,
				gl.RGBA,
				1,
				1,
				0,
				gl.RGBA,
				gl.UNSIGNED_BYTE,
				new Uint8Array([0, 0, 0, 255])
			);
		setClampedLinear(gl);
		gl.uniform1i(uniforms[name], unit);
		return item;
	}

	texture(UNIT_ATLAS, 'atlas', drawNameAtlas());

	// Placeholder until the worker has produced the face height map
	const portrait = texture(UNIT_PORTRAIT, 'portrait');

	// State
	const reduced = matchMedia('(prefers-reduced-motion: reduce)');
	const controller = new AbortController();
	const { signal } = controller;
	let width = 1,
		height = 1,
		count = 0,
		elapsed = 0,
		visible = false,
		disposed = false,
		ready = false;

	// Press-and-hold + burst state (burstAge is seconds since the burst; it rests at RAIN_CYCLE_END)
	let holding = false,
		holdStarted = 0,
		holdTime = 0,
		charge = 0,
		dead = false,
		burstAge = RAIN_CYCLE_END,
		burstX = 0,
		burstY = 0;
	let pointerId: number | null = null;

	const cursor = createRainCursor();
	const ripples = createRainRipples();

	// Resizes the canvas and rebuilds the rain
	function resize() {
		const rect = canvas.getBoundingClientRect();
		width = Math.max(1, rect.width);
		height = Math.max(1, rect.height);
		const dpr = Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO);
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.uniform2f(uniforms.resolution, width, height);
		scalar('dpr', dpr);

		count = uploadRainGlyphs(gl, buffer, width, height, GLYPH_SCALE, COLUMN_DENSITY);
		draw(0);
	}

	// Pointer handling. cancel() abandons any press without triggering a ripple or burst
	function cancel() {
		holding = false;
		pointerId = null;
		cursor.target = 0;
	}
	function move(event: PointerEvent) {
		aimRainCursor(canvas, cursor, event);
		cursor.target = holding || (canHover() && event.pointerType === 'mouse') ? 1 : 0;
	}
	function begin(event: PointerEvent) {
		if (event.button !== 0 || reduced.matches || dead || !ready) return;
		move(event);
		cursor.x = cursor.tx;
		cursor.y = cursor.ty;
		holding = true;
		holdStarted = performance.now();
		holdTime = 0;
		pointerId = event.pointerId;
		canvas.setPointerCapture(event.pointerId);
	}
	// Releasing after RAIN_CHARGE_SECONDS bursts the portrait; a shorter press drops a ripple
	function release(event: PointerEvent) {
		if (!holding || event.pointerId !== pointerId) return;
		holdTime = (performance.now() - holdStarted) / 1000;
		if (holdTime >= RAIN_CHARGE_SECONDS) {
			dead = true;
			burstAge = 0;
			burstX = cursor.x;
			burstY = cursor.y;
			silenceRainRipples(ripples);
		} else {
			dropRainRipple(ripples, cursor.x, cursor.y, holdTime);
		}
		cancel();
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
	}

	// Advances the clock, burst timeline and charge. With reduced motion everything is frozen and any press is cancelled.
	function advanceTimeline(dt: number, timelineDelta: number) {
		if (reduced.matches) {
			cancel();
			charge = 0;
			dead = false;
			return;
		}
		if (!dead || burstAge >= RAIN_RETURN_START) elapsed += dt * getSettings().matrixSpeed;
		if (holding) holdTime = (performance.now() - holdStarted) / 1000;
		burstAge = Math.min(RAIN_CYCLE_END, burstAge + timelineDelta);
		if (dead && burstAge >= RAIN_CYCLE_END) {
			dead = false;
			cursor.active = cursor.target = 0;
		}
		charge = easeRainCharge(charge, holding, holdTime, dt);
	}

	function drawBackdropPass() {
		gl.disable(gl.BLEND);
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(backgroundProgram);
		for (const [attribute] of attributes) gl.disableVertexAttribArray(attribute);
		drawRainBackdrop(gl, backgroundBuffer, backgroundPosition);
	}

	// Look settings come from the live settings panel; charge (0..1) deepens and brightens the portrait
	function setRainUniforms() {
		const settings = getSettings();
		const interactive = !reduced.matches && !dead;

		for (const [name, value] of Object.entries({
			time: elapsed,
			size: GLYPH_SCALE,
			brightness: settings.matrixBrightness,
			glow: settings.matrixGlow + charge * RAIN_CHARGE_BOOST.glow,
			fade: RAIN_LOOK.fade,
			face: settings.matrixFace,
			portraitSize: portraitSizeSetting(settings) * (1 + charge * RAIN_CHARGE_BOOST.portraitScale),
			depth: settings.matrixDepth + charge * RAIN_CHARGE_BOOST.depth,
			bend: settings.matrixBend * (1 - charge),
			angle: RAIN_LOOK.angle,
			reach: RAIN_LOOK.reach,
			ripple: interactive ? RAIN_LOOK.ripple : 0,
			chargeDetail: charge * RAIN_CHARGE_BOOST.detail,
			magnet: interactive ? cursor.active * CURSOR_MAGNET + charge * RAIN_CHARGE_BOOST.magnet : 0,
		}))
			scalar(name, value);

		gl.uniform2f(uniforms.cursor, cursor.x, cursor.y);
		gl.uniform2f(uniforms.tilt, 0, 0);
		gl.uniform2f(uniforms.chargeWave, holding ? holdTime : 0, rainChargeWave(holding, charge));
		gl.uniform4f(uniforms.burst, burstX, burstY, burstAge, dead ? 1 : 0);
		gl.uniform4fv(uniforms['waves[0]'], packRainRipples(ripples));
	}

	function drawRainPass() {
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(program);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		enableRainAttributes();

		// Additive blending
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);

		setRainUniforms();
		drawRainPasses(gl, uniforms.pass, count);
	}

	// Screen shake on the burst, decaying quickly; exposed to CSS as --matrix-x/--matrix-y
	function publishShake() {
		const shake =
			dead && !reduced.matches
				? SHAKE_PX * Math.exp(-burstAge * SHAKE_DECAY) * Math.min(1, burstAge * SHAKE_ATTACK)
				: 0;
		canvas.style.setProperty('--matrix-x', `${Math.sin(burstAge * SHAKE_FREQUENCY_X) * shake}px`);
		canvas.style.setProperty(
			'--matrix-y',
			`${Math.sin(burstAge * SHAKE_FREQUENCY_Y + 1) * shake * SHAKE_Y_RATIO}px`
		);
	}

	// Phase exposed for styling and tests
	function publishPhase() {
		section.dataset.matrixPhase = holding
			? 'charging'
			: dead
				? burstAge < RAIN_RETURN_START
					? 'disintegrating'
					: 'reforming'
				: 'rain';
	}

	// One frame. dt drives motion (capped by the ticker); timelineDelta advances the burst timeline.
	function draw(dt: number, timelineDelta = dt) {
		if (disposed) return;
		advanceTimeline(dt, timelineDelta);

		if (!holding && !canHover()) cursor.target = 0;
		easeRainCursor(cursor, dt);
		ageRainRipples(ripples, dt);

		drawBackdropPass();
		drawRainPass();
		publishShake();
		publishPhase();
	}

	// Ticker callback; syncTicker() adds it only while visible, ready, and motion is allowed
	const tick = (_time: number, delta: number) => {
		if (visible && ready && !document.hidden && !reduced.matches)
			draw(Math.min(delta / 1000, RAIN_MAX_FRAME_SECONDS), delta / 1000);
	};
	function syncTicker() {
		gsap.ticker.remove(tick);
		if (visible && ready && !document.hidden && !reduced.matches) gsap.ticker.add(tick);
		else cancel();
		if (ready && visible && !document.hidden) draw(0);
	}

	// Face height map: load the PNG, shrink it, let the worker cut out the backdrop and
	// convert to luminance, then upload it as the portrait texture and start rendering
	let portraitWorker: Worker | undefined;
	const img = new Image();

	const showFallback = () => {
		if (!disposed) section.dataset.state = 'fallback';
	};
	function applyPortrait(map: HTMLCanvasElement) {
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, portrait);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map);
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(program);
		scalar('aspect', img.width / img.height);
		ready = true;
		section.dataset.state = 'ready';
		resize();
		syncTicker();
	}
	img.onload = () => {
		if (disposed) return;
		const map = document.createElement('canvas');
		map.width = PORTRAIT_MAP_WIDTH;
		map.height = Math.round((PORTRAIT_MAP_WIDTH * img.height) / img.width);
		const context = required(map.getContext('2d'));
		context.drawImage(img, 0, 0, map.width, map.height);
		const pixels = context.getImageData(0, 0, map.width, map.height);
		const worker = new Worker(new URL('./portrait.worker.ts', import.meta.url));
		portraitWorker = worker;
		worker.onmessage = (event: MessageEvent<ImageData>) => {
			worker.terminate();
			portraitWorker = undefined;
			if (disposed) return;
			context.putImageData(event.data, 0, 0);
			applyPortrait(map);
		};
		worker.onerror = () => {
			worker.terminate();
			portraitWorker = undefined;
			showFallback();
		};
		worker.postMessage(pixels, [pixels.data.buffer]);
	};
	img.onerror = showFallback;
	img.src = PORTRAIT_URL;

	const unsubscribeSettings = subscribe(() => {
		if (ready) draw(0);
	});

	// Listeners (all removed through the abort signal)
	const observer = new ResizeObserver(resize);
	observer.observe(canvas);
	canvas.addEventListener('pointermove', move, { signal });
	canvas.addEventListener('pointerdown', begin, { signal });
	canvas.addEventListener('pointerup', release, { signal });
	canvas.addEventListener('pointercancel', cancel, { signal });
	canvas.addEventListener('lostpointercapture', cancel, { signal });
	canvas.addEventListener(
		'pointerleave',
		() => {
			if (!holding) cursor.target = 0;
		},
		{ signal }
	);
	window.addEventListener('blur', cancel, { signal });
	document.addEventListener('visibilitychange', syncTicker, { signal });
	reduced.addEventListener('change', syncTicker, { signal });

	// On context loss show the fallback; on restore ask the section to rebuild this scene
	canvas.addEventListener(
		'webglcontextlost',
		event => {
			event.preventDefault();
			ready = false;
			gsap.ticker.remove(tick);
			cancel();
			section.dataset.state = 'fallback';
		},
		{ signal }
	);
	canvas.addEventListener('webglcontextrestored', () => section.dispatchEvent(new Event('matrixrestore')), {
		signal,
	});

	// Handle
	return {
		setVisible(value) {
			visible = value;
			syncTicker();
		},
		destroy() {
			disposed = true;
			controller.abort();
			observer.disconnect();
			unsubscribeSettings();
			gsap.ticker.remove(tick);
			img.onload = null;
			portraitWorker?.terminate();
			img.onerror = null;
			for (const item of textures) gl.deleteTexture(item);
			for (const shader of shaders) gl.deleteShader(shader);
			gl.deleteBuffer(buffer);
			gl.deleteBuffer(backgroundBuffer);
			gl.deleteProgram(backgroundProgram);
			gl.deleteProgram(program);
			canvas.style.removeProperty('--matrix-x');
			canvas.style.removeProperty('--matrix-y');
		},
	};
}
