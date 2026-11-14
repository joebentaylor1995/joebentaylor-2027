// Imports
// ------------
import { baseColors } from '@theme/colors';
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
import { enableParallelCompile, setClampedLinear, waitForProgram } from '@utils/webgl';
import { gsap } from 'gsap';
import { fragment, vertex } from './shaders';

// Constants
// ------------
// Vertical gradient backdrop between two brand colours
const BACKDROP_VERTEX =
	'attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';
const BACKDROP_FRAGMENT =
	'precision mediump float;varying vec2 uv;uniform vec3 top;uniform vec3 bottom;void main(){gl_FragColor=vec4(mix(top,bottom,1.-uv.y),1.);}';

// Height map: "404" stretched to a fixed width on a wide canvas
const HEIGHT_MAP_WIDTH = 1536;
const HEIGHT_MAP_HEIGHT = 640;
const HEIGHT_MAP_TEXT_WIDTH = 1360;
const HEIGHT_MAP_HALO_BLUR = 12;

const ATLAS_GLYPHS =
	'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789<>+=*:⟐∆';

// Texture units
const ATLAS_UNIT = 0;
const HEIGHT_MAP_UNIT = 1;

// Static look (the charge animation re-drives some of these per frame)
const GLYPH_SCALE = 8 / 23;
const LOOK = {
	size: GLYPH_SCALE,
	brightness: 0.95,
	glow: 0.65,
	fade: RAIN_LOOK.fade,
	face: 2.3,
	portraitSize: 0.95,
	aspect: 2.4,
	depth: 0.65,
	bend: 0.3,
	angle: RAIN_LOOK.angle,
	reach: RAIN_LOOK.reach,
	ripple: RAIN_LOOK.ripple,
};

// Canvas pixel ratio cap, lower on phones
const PHONE_MAX_WIDTH = 600;
const PHONE_PIXEL_RATIO = 1.5;
const DESKTOP_PIXEL_RATIO = 2;

// Columns packed closer together than the base spacing
const COLUMN_DENSITY = 1.5;

// How fast the rain plays
const TIME_SCALE = 1.3;

// Seconds the burst age rests at between bursts
const BURST_REST_AGE = 8;

// Pointer pull and camera tilt at full hover
const CURSOR_MAGNET = 0.65;
const TILT_X = 0.65;
const TILT_Y = 0.35;

// State
// ------------
// Canvases that already hold a frame (a route shown again from React Activity remounts on its old canvas)
const drawnCanvases = new WeakSet<HTMLCanvasElement>();

// Helpers
// ------------
// '#rrggbb' to [r, g, b] in 0..1
const rgb = (hex: string) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);

// Lets the browser render a frame between heavy setup steps
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

// GL object factories: each one registers what it creates so free() can delete it
function createGpuRegistry(gl: WebGLRenderingContext) {
	const shaders: WebGLShader[] = [],
		programs: WebGLProgram[] = [],
		textures: WebGLTexture[] = [],
		buffers: WebGLBuffer[] = [];

	const compile = (type: number, source: string) => {
		const shader = gl.createShader(type);
		if (!shader) throw new Error('Shader unavailable');
		shaders.push(shader);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		return shader;
	};

	return {
		// Compiles and links without reading the result (see verify())
		program(vs: string, fs: string) {
			const result = gl.createProgram();
			if (!result) throw new Error('Program unavailable');
			programs.push(result);
			gl.attachShader(result, compile(gl.VERTEX_SHADER, vs));
			gl.attachShader(result, compile(gl.FRAGMENT_SHADER, fs));
			gl.linkProgram(result);
			return result;
		},
		// Throws with the compiler's log if the program failed; call once it has linked
		verify(program: WebGLProgram) {
			if (gl.getProgramParameter(program, gl.LINK_STATUS)) return;
			for (const shader of gl.getAttachedShaders(program) ?? [])
				if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
					throw new Error(gl.getShaderInfoLog(shader) || 'Shader failed');
			throw new Error(gl.getProgramInfoLog(program) || 'Link failed');
		},
		buffer() {
			const result = gl.createBuffer();
			if (!result) throw new Error('Buffer unavailable');
			buffers.push(result);
			return result;
		},
		// Uploads a canvas as a clamped, linear-filtered texture on the given unit
		upload(unit: number, source: HTMLCanvasElement) {
			const texture = gl.createTexture();
			if (!texture) throw new Error('Texture unavailable');
			textures.push(texture);
			gl.activeTexture(gl.TEXTURE0 + unit);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
			setClampedLinear(gl);
		},
		free() {
			for (const resource of textures) gl.deleteTexture(resource);
			for (const resource of buffers) gl.deleteBuffer(resource);
			for (const resource of programs) gl.deleteProgram(resource);
			for (const resource of shaders) gl.deleteShader(resource);
		},
	};
}

// One generated height map drives every glyph's light, normal and displacement.
// Draws "404" bold, stretched to a fixed width and vertically centred, with a soft halo under a solid fill.
function drawHeightMap() {
	const map = Object.assign(document.createElement('canvas'), { width: HEIGHT_MAP_WIDTH, height: HEIGHT_MAP_HEIGHT });
	const c = map.getContext('2d');
	if (!c) throw new Error('Canvas unavailable');
	c.fillStyle = '#000';
	c.fillRect(0, 0, HEIGHT_MAP_WIDTH, HEIGHT_MAP_HEIGHT);
	c.font = '900 660px Arial, sans-serif';
	c.textAlign = 'center';
	const metrics = c.measureText('404');
	c.translate(HEIGHT_MAP_WIDTH / 2, 0);
	c.scale(HEIGHT_MAP_TEXT_WIDTH / metrics.width, 1);
	const baseline = (HEIGHT_MAP_HEIGHT + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
	c.shadowColor = '#aaa';
	c.shadowBlur = HEIGHT_MAP_HALO_BLUR;
	c.fillStyle = '#eee';
	c.fillText('404', 0, baseline);
	c.shadowBlur = 0;
	c.fillStyle = '#fff';
	c.fillText('404', 0, baseline);
	return map;
}

// Glyph atlas of katakana, digits and symbols
function drawAtlas() {
	const atlas = Object.assign(document.createElement('canvas'), { width: RAIN_ATLAS_SIZE, height: RAIN_ATLAS_SIZE });
	const a = atlas.getContext('2d');
	if (!a) throw new Error('Atlas unavailable');
	a.fillStyle = '#fff';
	a.font = '42px "Hiragino Kaku Gothic ProN", "Yu Gothic", monospace';
	a.textAlign = 'center';
	a.textBaseline = 'middle';
	fillGlyphGrid(a, Array.from(ATLAS_GLYPHS));
	return atlas;
}

// Engine
// ------------
// Mounts the 404 digital-rain scene. Two programs run each frame: a gradient backdrop, then a
// point-sprite pass where every glyph is a point whose position, brightness and shape are decided
// in the vertex shader. A canvas-baked "404" height map lifts the rain into relief.
// Pointer input adds ripples (a tap) or a charge-and-release burst that dissolves the glyphs (a hold).
// Returns { pause, destroy } straight away and finishes setting up once the shaders have linked,
// then reports onReady(true). Throws if the GPU can't create its programs; a later setup failure
// releases the GL resources and reports onReady(false).
export function mountNotFoundRain(canvas: HTMLCanvasElement, onReady: (ready: boolean) => void) {
	// Context
	// NOTE • depth: false — nothing here depth-tests, so the default depth buffer (a full-size
	// allocation) was never read or written
	const context = canvas.getContext('webgl', {
		alpha: false,
		antialias: false,
		depth: false,
		powerPreference: 'low-power',
	});
	if (!context) return { destroy() {}, pause(_value: boolean) {} };
	const gl = context;
	enableParallelCompile(gl);
	const bindProgram = gl.useProgram.bind(gl);
	const events = new AbortController();
	const motion = matchMedia('(prefers-reduced-motion: reduce)');
	const gpu = createGpuRegistry(gl);

	// Runtime state
	let disposed = false,
		paused = false,
		dirty = true,
		width = 1,
		height = 1,
		count = 0,
		elapsed = 0;

	// The running scene's handles, once setup has finished
	let running: { pause: (value: boolean) => void; destroy: () => void } | null = null;

	// NOTE • Why: the shaders link in parallel and the setup is spread over a few tasks, so the
	// page keeps rendering in between. An opaque (alpha: false) WebGL canvas that hasn't drawn
	// yet can show as a black box over the CSS "404" meanwhile; it stays transparent until the
	// point where the old single-task setup first showed it, straight after its first frame.
	// A canvas that has drawn before keeps showing what it showed, as it always has.
	const isNewCanvas = !drawnCanvases.has(canvas);
	if (isNewCanvas) canvas.dataset.state = 'pending';
	const reveal = () => {
		if (isNewCanvas) delete canvas.dataset.state;
	};

	// Releases everything a setup that never finished created
	const abandon = () => {
		events.abort();
		gpu.free();
		reveal();
	};

	try {
		// Programs: the glyph rain, and the gradient backdrop
		const rain = gpu.program(vertex, fragment);
		const background = gpu.program(BACKDROP_VERTEX, BACKDROP_FRAGMENT);

		// NOTE • Why: reading LINK_STATUS straight after linking blocked the main thread until the
		// GPU process had compiled the rain's large vertex shader, as the 404 opened. This waits
		// for both programs without blocking, then sets up exactly as before.
		const start = async () => {
			const linked = await Promise.all([
				waitForProgram(gl, rain, () => disposed),
				waitForProgram(gl, background, () => disposed),
			]);
			if (!linked.every(Boolean)) return;
			// A context lost mid-setup (before its listener exists) abandons the setup, so the CSS 404 stays
			if (gl.isContextLost()) throw new Error('Rain context lost');
			gpu.verify(rain);
			gpu.verify(background);

			bindProgram(background);
			gl.uniform3fv(gl.getUniformLocation(background, 'top'), rgb(baseColors.brand.c4));
			gl.uniform3fv(gl.getUniformLocation(background, 'bottom'), rgb(baseColors.brand.c1));

			const backdrop = gpu.buffer();
			gl.bindBuffer(gl.ARRAY_BUFFER, backdrop);
			gl.bufferData(gl.ARRAY_BUFFER, RAIN_BACKDROP_VERTICES, gl.STATIC_DRAW);
			const position = gl.getAttribLocation(background, 'position');

			bindProgram(rain);

			const uniforms = lookupRainUniforms(gl, rain, ['blue']);
			const value = (name: string, amount: number) => gl.uniform1f(uniforms[name], amount);

			// The two canvas bakes are the heaviest steps; each gets its own task
			gpu.upload(HEIGHT_MAP_UNIT, drawHeightMap());
			await nextTask();
			if (disposed) return;
			if (gl.isContextLost()) throw new Error('Rain context lost');
			gpu.upload(ATLAS_UNIT, drawAtlas());
			await nextTask();
			if (disposed) return;
			if (gl.isContextLost()) throw new Error('Rain context lost');

			// Texture units, then static look settings
			gl.uniform1i(uniforms.atlas, ATLAS_UNIT);
			gl.uniform1i(uniforms.portrait, HEIGHT_MAP_UNIT);
			gl.uniform3fv(uniforms.blue, rgb(baseColors.brand.c1));
			for (const [name, amount] of Object.entries(LOOK)) value(name, amount);

			// Particle buffer: 6 floats per glyph (x, y, speed, glyph, size, brightness), rebuilt on resize
			const particles = gpu.buffer(),
				drop = gl.getAttribLocation(rain, 'a_drop'),
				style = gl.getAttribLocation(rain, 'a_style');

			// Size the canvas and regenerate the rain
			let applied = '';
			const resize = () => {
				width = Math.max(1, canvas.clientWidth);
				height = Math.max(1, canvas.clientHeight);
				const ratio = Math.min(
					devicePixelRatio || 1,
					width <= PHONE_MAX_WIDTH ? PHONE_PIXEL_RATIO : DESKTOP_PIXEL_RATIO
				);
				// NOTE • The glyph layout is seeded, so the same size and ratio rebuild the same
				// buffer. The ResizeObserver's first callback (straight after the explicit call
				// below) would otherwise redo ~300k numbers and the upload for nothing.
				const size = `${width}x${height}@${ratio}`;
				if (size === applied) return;
				applied = size;
				canvas.width = Math.round(width * ratio);
				canvas.height = Math.round(height * ratio);
				gl.viewport(0, 0, canvas.width, canvas.height);
				bindProgram(rain);
				gl.uniform2f(uniforms.resolution, width, height);
				value('dpr', ratio);

				count = uploadRainGlyphs(gl, particles, width, height, GLYPH_SCALE, COLUMN_DENSITY);
				dirty = true;
			};

			// Pointer, tap ripples and press-and-hold charge.
			// Releasing after the hold threshold dissolves the glyphs (dead) and then re-forms them.
			const cursor = createRainCursor();
			const ripples = createRainRipples();
			const charge = {
				holding: false,
				started: 0,
				held: 0,
				amount: 0,
				age: BURST_REST_AGE,
				dead: false,
				x: 0,
				y: 0,
				pointer: -1,
			};

			const point = (event: PointerEvent) => {
				aimRainCursor(canvas, cursor, event);
				cursor.target = 1;
			};

			// End a press: a long hold bursts the scene, a short one drops a ripple; cancel just discards it
			const finish = (cancel = false) => {
				if (!charge.holding) return;
				charge.holding = false;
				const seconds = (performance.now() - charge.started) / 1000;
				if (cancel || paused || motion.matches) return;
				if (seconds >= RAIN_CHARGE_SECONDS) {
					charge.dead = true;
					charge.age = 0;
					charge.x = cursor.x;
					charge.y = cursor.y;
					cursor.target = 0;
					silenceRainRipples(ripples);
				} else {
					dropRainRipple(ripples, cursor.x, cursor.y, seconds);
				}
			};

			const press = (event: PointerEvent) => {
				if (event.button !== 0 || paused || motion.matches || charge.dead) return;
				point(event);
				cursor.x = cursor.tx;
				cursor.y = cursor.ty;
				charge.holding = true;
				charge.started = performance.now();
				charge.pointer = event.pointerId;
				canvas.setPointerCapture(event.pointerId);
			};
			const lift = (event: PointerEvent) => {
				if (event.pointerId !== charge.pointer) return;
				finish();
				if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
				if (event.pointerType === 'touch') cursor.target = 0;
			};
			const leave = () => {
				if (!charge.holding) cursor.target = 0;
			};
			const abandonPress = () => {
				finish(true);
				cursor.target = 0;
			};
			const onVisibilityChange = () => {
				finish(true);
				dirty = true;
			};
			const onMotionChange = () => {
				finish(true);
				charge.amount = 0;
				dirty = true;
			};
			const onContextLost = (event: Event) => {
				event.preventDefault();
				disposed = true;
				onReady(false);
			};

			// Input listeners, all removed with events.abort()
			const { signal } = events;
			canvas.addEventListener('pointermove', point, { signal });
			canvas.addEventListener('pointerdown', press, { signal });
			canvas.addEventListener('pointerup', lift, { signal });
			canvas.addEventListener('pointerleave', leave, { signal });
			canvas.addEventListener('pointercancel', abandonPress, { signal });
			canvas.addEventListener('lostpointercapture', () => finish(true), { signal });
			window.addEventListener('blur', abandonPress, { signal });
			document.addEventListener('visibilitychange', onVisibilityChange, { signal });
			motion.addEventListener('change', onMotionChange, { signal });
			canvas.addEventListener('webglcontextlost', onContextLost, { signal });

			const observer = new ResizeObserver(resize);
			observer.observe(canvas);
			resize();

			cursor.x = cursor.tx = width / 2;
			cursor.y = cursor.ty = height / 2;

			// Advances the clock, cursor, burst timeline, charge and ripples by one frame
			const advanceMotion = (dt: number) => {
				if (!charge.dead || charge.age >= RAIN_RETURN_START) elapsed += dt * TIME_SCALE;

				easeRainCursor(cursor, dt);
				charge.age = Math.min(BURST_REST_AGE, charge.age + dt);
				if (charge.age >= RAIN_CYCLE_END) charge.dead = false;
				charge.held = charge.holding ? (performance.now() - charge.started) / 1000 : 0;
				charge.amount = easeRainCharge(charge.amount, charge.holding, charge.held, dt);
				ageRainRipples(ripples, dt);
			};

			const drawBackdropPass = () => {
				gl.disable(gl.BLEND);
				bindProgram(background);
				drawRainBackdrop(gl, backdrop, position);
			};

			const bindRainAttributes = () => {
				bindProgram(rain);
				gl.bindBuffer(gl.ARRAY_BUFFER, particles);
				gl.enableVertexAttribArray(drop);
				gl.enableVertexAttribArray(style);
				gl.vertexAttribPointer(drop, 4, gl.FLOAT, false, 24, 0);
				gl.vertexAttribPointer(style, 2, gl.FLOAT, false, 24, 16);
				// Additive blending
				gl.enable(gl.BLEND);
				gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
			};

			// Charging deepens the relief, brightens and magnetises the glyphs
			const setRainUniforms = () => {
				const q = charge.amount,
					enabled = motion.matches || charge.dead ? 0 : 1;

				value('time', elapsed);
				value('depth', LOOK.depth + q * RAIN_CHARGE_BOOST.depth);
				value('bend', LOOK.bend * (1 - q));
				value('glow', LOOK.glow + q * RAIN_CHARGE_BOOST.glow);
				value('portraitSize', LOOK.portraitSize * (1 + q * RAIN_CHARGE_BOOST.portraitScale));
				value('chargeDetail', q * RAIN_CHARGE_BOOST.detail);
				value('magnet', (CURSOR_MAGNET * cursor.active + q * RAIN_CHARGE_BOOST.magnet) * enabled);
				value('ripple', LOOK.ripple * enabled);

				gl.uniform2f(uniforms.cursor, cursor.x, cursor.y);
				gl.uniform2f(
					uniforms.tilt,
					(cursor.x / width - 0.5) * TILT_X * cursor.active * enabled,
					(cursor.y / height - 0.5) * TILT_Y * cursor.active * enabled
				);
				gl.uniform2f(uniforms.chargeWave, charge.held, rainChargeWave(charge.holding, q));
				gl.uniform4f(uniforms.burst, charge.x, charge.y, charge.age, charge.dead ? 1 : 0);
				gl.uniform4fv(uniforms['waves[0]'], packRainRipples(ripples));
			};

			const drawRainPass = () => {
				bindRainAttributes();
				setRainUniforms();
				drawRainPasses(gl, uniforms.pass, count);
				gl.disableVertexAttribArray(drop);
				gl.disableVertexAttribArray(style);
			};

			// Frame: skips while hidden, mid-navigation, or idle in a paused/reduced-motion state with nothing to redraw
			const tick = (_time: number, delta: number) => {
				if (
					disposed ||
					document.hidden ||
					document.documentElement.matches('[data-navigation-pending], [data-navigation-wave]') ||
					((paused || motion.matches) && !dirty)
				)
					return;

				dirty = false;
				// NOTE • The vsync step (see src/utils/frameClock.ts), so the rain falls evenly;
				// GSAP's own delta is whole milliseconds. Falls back to it on a run's first frame.
				// The synchronous first draw below passes 0 and still advances nothing.
				const step = delta === 0 ? 0 : frameStep() || delta;
				advanceMotion(paused || motion.matches ? 0 : Math.min(step / 1000, RAIN_MAX_FRAME_SECONDS));
				drawBackdropPass();
				drawRainPass();
			};

			gsap.ticker.add(tick);
			tick(0, 0);
			drawnCanvases.add(canvas);
			reveal();
			onReady(true);

			running = {
				pause(value: boolean) {
					paused = value;
					finish(true);
					dirty = true;
				},
				destroy() {
					disposed = true;
					gsap.ticker.remove(tick);
					events.abort();
					observer.disconnect();
					gpu.free();
				},
			};
		};

		void start().catch(() => {
			abandon();
			onReady(false);
		});
	} catch (error) {
		abandon();
		throw error;
	}

	return {
		pause(value: boolean) {
			if (running) running.pause(value);
			else {
				paused = value;
				dirty = true;
			}
		},
		destroy() {
			if (running) running.destroy();
			else {
				disposed = true;
				abandon();
			}
		},
	};
}
