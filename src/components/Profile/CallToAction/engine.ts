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
import { frameStep } from '@utils/frameClock';
import { yieldSceneWork } from '@utils/prepareScene';
import { enableParallelCompile, setClampedLinear, waitForProgram } from '@utils/webgl';
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
// What the shake offsets read at rest (no burst, or reduced motion)
const SHAKE_REST = '0px';

// Types
// ------------
// The GL objects every frame uses, available once the programs have linked
interface RainGpu {
	program: WebGLProgram;
	backgroundProgram: WebGLProgram;
	uniforms: Record<string, WebGLUniformLocation | null>;
	backgroundPosition: number;
	backgroundBuffer: WebGLBuffer;
	buffer: WebGLBuffer;
	attributes: readonly (readonly [number, number, number])[];
	portrait: WebGLTexture;
}

// The face height map (greyscale, opaque) and the source portrait's aspect ratio
interface PortraitMap {
	pixels: ImageData;
	aspect: number;
}

// State
// ------------
// NOTE • The height map depends only on the PNG, so it is built once per page load. Reopening
// the profile (or rebuilding after a context restore) skips the decode, the canvas readback
// and the worker, and uploads the very same pixels.
let portraitCache: PortraitMap | undefined;

// Helpers
// ------------
// Unwraps a GL resource, throwing if the browser could not allocate it
function required<T>(value: T | null): T {
	if (!value) throw new Error('Matrix resource unavailable');
	return value;
}

// Starts compiling and linking a program. The result is read once the GPU process has finished
// (waitForProgram), so the main thread never waits on the compile.
function startProgram(gl: WebGLRenderingContext, shaders: WebGLShader[], vertex: string, fragment: string) {
	const program = required(gl.createProgram());
	for (const [kind, source] of [
		[gl.VERTEX_SHADER, vertex],
		[gl.FRAGMENT_SHADER, fragment],
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
//
// NOTE • Why the GL setup is asynchronous: it used to run in one task one screen before Connect,
// mid-scroll. Reading COMPILE_STATUS / LINK_STATUS straight after compiling blocked the main
// thread until the GPU process had compiled the rain shader (tens to hundreds of ms). The
// programs now link in the background and the atlas is drawn in a later task; nothing renders
// until the portrait is ready, exactly as before.
export function createMatrix(canvas: HTMLCanvasElement, section: HTMLElement): MatrixScene {
	// Programs (compiling from here on; read in init())
	const gl = required(canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' }));
	enableParallelCompile(gl);
	const shaders: WebGLShader[] = [];
	const program = startProgram(gl, shaders, vertexShader, fragmentShader);
	const backgroundProgram = startProgram(gl, shaders, BACKDROP_VERTEX, BACKDROP_FRAGMENT);
	const buffers: WebGLBuffer[] = [];
	const textures: WebGLTexture[] = [];
	let gpu: RainGpu | undefined;

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
	// The size the canvas and glyph layout were last built for
	let laidOut = { width: 0, height: 0, dpr: 0 };
	// The shake offsets last written to the canvas
	let shakeX = '',
		shakeY = '';

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

	const scalar = (name: string, value: number) => {
		if (gpu) gl.uniform1f(gpu.uniforms[name], value);
	};

	// Creates a clamped linear texture on a unit and binds its sampler uniform; without a source it is a 1px black placeholder
	function texture(uniforms: RainGpu['uniforms'], unit: number, name: string, source?: HTMLCanvasElement) {
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

	// Particle buffer, 24-byte stride: a_drop (x, y, speed, glyph index) then a_style (size, brightness)
	function enableRainAttributes({ attributes }: RainGpu) {
		for (const [attribute, size, offset] of attributes) {
			gl.enableVertexAttribArray(attribute);
			gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 24, offset);
		}
	}

	// Resizes the canvas and rebuilds the rain
	function resize() {
		if (!gpu) return;
		const rect = canvas.getBoundingClientRect();
		width = Math.max(1, rect.width);
		height = Math.max(1, rect.height);
		const dpr = Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO);
		// NOTE • Why: the ResizeObserver's first callback and the portrait arriving both resize at
		// the same size. Re-setting canvas.width reallocates the drawing buffer and the glyph
		// layout was rebuilt identically; draw(0) below repaints every pixel either way.
		if (width !== laidOut.width || height !== laidOut.height || dpr !== laidOut.dpr) {
			laidOut = { width, height, dpr };
			canvas.width = Math.round(width * dpr);
			canvas.height = Math.round(height * dpr);
			gl.viewport(0, 0, canvas.width, canvas.height);
			gl.uniform2f(gpu.uniforms.resolution, width, height);
			scalar('dpr', dpr);

			count = uploadRainGlyphs(gl, gpu.buffer, width, height, GLYPH_SCALE, COLUMN_DENSITY);
		}
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

	function drawBackdropPass({ backgroundProgram, attributes, backgroundBuffer, backgroundPosition }: RainGpu) {
		gl.disable(gl.BLEND);
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(backgroundProgram);
		for (const [attribute] of attributes) gl.disableVertexAttribArray(attribute);
		drawRainBackdrop(gl, backgroundBuffer, backgroundPosition);
	}

	// Look settings come from the live settings panel; charge (0..1) deepens and brightens the portrait.
	// NOTE • Why: this used to build an object and its Object.entries() every frame. The constant
	// uniforms (size, fade, angle, reach, tilt) are set once in init(); the rest go straight in.
	function setRainUniforms({ uniforms }: RainGpu) {
		const settings = getSettings();
		const interactive = !reduced.matches && !dead;

		gl.uniform1f(uniforms.time, elapsed);
		gl.uniform1f(uniforms.brightness, settings.matrixBrightness);
		gl.uniform1f(uniforms.glow, settings.matrixGlow + charge * RAIN_CHARGE_BOOST.glow);
		gl.uniform1f(uniforms.face, settings.matrixFace);
		gl.uniform1f(
			uniforms.portraitSize,
			portraitSizeSetting(settings) * (1 + charge * RAIN_CHARGE_BOOST.portraitScale)
		);
		gl.uniform1f(uniforms.depth, settings.matrixDepth + charge * RAIN_CHARGE_BOOST.depth);
		gl.uniform1f(uniforms.bend, settings.matrixBend * (1 - charge));
		gl.uniform1f(uniforms.ripple, interactive ? RAIN_LOOK.ripple : 0);
		gl.uniform1f(uniforms.chargeDetail, charge * RAIN_CHARGE_BOOST.detail);
		gl.uniform1f(
			uniforms.magnet,
			interactive ? cursor.active * CURSOR_MAGNET + charge * RAIN_CHARGE_BOOST.magnet : 0
		);

		gl.uniform2f(uniforms.cursor, cursor.x, cursor.y);
		gl.uniform2f(uniforms.chargeWave, holding ? holdTime : 0, rainChargeWave(holding, charge));
		gl.uniform4f(uniforms.burst, burstX, burstY, burstAge, dead ? 1 : 0);
		gl.uniform4fv(uniforms['waves[0]'], packRainRipples(ripples));
	}

	function drawRainPass(rain: RainGpu) {
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(rain.program);
		gl.bindBuffer(gl.ARRAY_BUFFER, rain.buffer);
		enableRainAttributes(rain);

		// Additive blending
		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);

		setRainUniforms(rain);
		drawRainPasses(gl, rain.uniforms.pass, count);
	}

	// Screen shake on the burst, decaying quickly; exposed to CSS as --matrix-x/--matrix-y.
	// NOTE • Written only when the value changes: at rest it is 0px every frame.
	function publishShake() {
		const shake =
			dead && !reduced.matches
				? SHAKE_PX * Math.exp(-burstAge * SHAKE_DECAY) * Math.min(1, burstAge * SHAKE_ATTACK)
				: 0;
		const x = shake ? `${Math.sin(burstAge * SHAKE_FREQUENCY_X) * shake}px` : SHAKE_REST;
		const y = shake ? `${Math.sin(burstAge * SHAKE_FREQUENCY_Y + 1) * shake * SHAKE_Y_RATIO}px` : SHAKE_REST;
		if (x !== shakeX) canvas.style.setProperty('--matrix-x', x);
		if (y !== shakeY) canvas.style.setProperty('--matrix-y', y);
		shakeX = x;
		shakeY = y;
	}

	// Phase exposed for styling and tests (written only when it changes)
	function publishPhase() {
		const phase = holding
			? 'charging'
			: dead
				? burstAge < RAIN_RETURN_START
					? 'disintegrating'
					: 'reforming'
				: 'rain';
		if (section.dataset.matrixPhase !== phase) section.dataset.matrixPhase = phase;
	}

	// One frame. dt drives motion (capped by the ticker); timelineDelta advances the burst timeline.
	function draw(dt: number, timelineDelta = dt) {
		if (disposed || !gpu) return;
		advanceTimeline(dt, timelineDelta);

		if (!holding && !canHover()) cursor.target = 0;
		easeRainCursor(cursor, dt);
		ageRainRipples(ripples, dt);

		drawBackdropPass(gpu);
		drawRainPass(gpu);
		publishShake();
		publishPhase();
	}

	// Ticker callback; syncTicker() adds it only while visible, ready, and motion is allowed.
	// Stepped by this frame's vsync interval.
	const tick = () => {
		if (!visible || !ready || document.hidden || reduced.matches) return;
		const seconds = frameStep() / 1000;
		draw(Math.min(seconds, RAIN_MAX_FRAME_SECONDS), seconds);
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
	let portraitMap = portraitCache;
	const img = new Image();

	const showFallback = () => {
		if (!disposed) section.dataset.state = 'fallback';
	};
	// NOTE • The map is opaque (the worker writes alpha 255), so uploading its ImageData gives the
	// same texels as uploading the canvas it used to be put into
	function applyPortrait(rain: RainGpu, map: PortraitMap) {
		gl.activeTexture(gl.TEXTURE0 + UNIT_PORTRAIT);
		gl.bindTexture(gl.TEXTURE_2D, rain.portrait);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, map.pixels);
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(rain.program);
		scalar('aspect', map.aspect);
		ready = true;
		section.dataset.state = 'ready';
		resize();
		syncTicker();
	}
	if (!portraitMap) {
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
				portraitCache = { pixels: event.data, aspect: img.width / img.height };
				if (disposed) return;
				portraitMap = portraitCache;
				if (gpu) applyPortrait(gpu, portraitMap);
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
	}

	const unsubscribeSettings = subscribe(() => {
		if (ready) draw(0);
	});

	// Listeners (all removed through the abort signal)
	const observer = new ResizeObserver(resize);
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

	// Frees every GL object created so far
	function releaseResources() {
		for (const item of textures) gl.deleteTexture(item);
		for (const shader of shaders) gl.deleteShader(shader);
		for (const item of buffers) gl.deleteBuffer(item);
		gl.deleteProgram(backgroundProgram);
		gl.deleteProgram(program);
	}

	// Waits for both programs, then builds buffers, attributes and (a task later) the textures
	async function init() {
		const cancelled = () => disposed;
		const linked = await Promise.all([
			waitForProgram(gl, program, cancelled),
			waitForProgram(gl, backgroundProgram, cancelled),
		]);
		if (linked.includes(false)) return;
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Matrix program could not link');
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(program);

		const uniforms = lookupRainUniforms(gl, program);
		// NOTE • Constant for the scene's life (uniforms keep their values), so set once here
		gl.uniform1f(uniforms.size, GLYPH_SCALE);
		gl.uniform1f(uniforms.fade, RAIN_LOOK.fade);
		gl.uniform1f(uniforms.angle, RAIN_LOOK.angle);
		gl.uniform1f(uniforms.reach, RAIN_LOOK.reach);
		gl.uniform2f(uniforms.tilt, 0, 0);

		const backgroundPosition = gl.getAttribLocation(backgroundProgram, 'position');
		const backgroundBuffer = required(gl.createBuffer());
		buffers.push(backgroundBuffer);
		gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
		gl.bufferData(gl.ARRAY_BUFFER, RAIN_BACKDROP_VERTICES, gl.STATIC_DRAW);

		const buffer = required(gl.createBuffer());
		buffers.push(buffer);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		const attributes = [
			[gl.getAttribLocation(program, 'a_drop'), 4, 0],
			[gl.getAttribLocation(program, 'a_style'), 2, 16],
		] as const;

		// Textures: the atlas, and a placeholder until the worker has produced the face height map
		await yieldSceneWork();
		if (disposed || gl.isContextLost()) return;
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(program);
		texture(uniforms, UNIT_ATLAS, 'atlas', drawNameAtlas());
		const portrait = texture(uniforms, UNIT_PORTRAIT, 'portrait');
		gpu = {
			program,
			backgroundProgram,
			uniforms,
			backgroundPosition,
			backgroundBuffer,
			buffer,
			attributes,
			portrait,
		};
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		enableRainAttributes(gpu);

		observer.observe(canvas);
		if (!portraitMap) return;
		// A cached map: upload it in its own task, as the worker's reply would arrive
		await yieldSceneWork();
		if (!disposed && !gl.isContextLost()) applyPortrait(gpu, portraitMap);
	}

	const prepared = init().catch(() => {
		if (disposed) return;
		releaseResources();
		showFallback();
	});

	// Handle
	return {
		prepared,
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
			releaseResources();
			canvas.style.removeProperty('--matrix-x');
			canvas.style.removeProperty('--matrix-y');
		},
	};
}
