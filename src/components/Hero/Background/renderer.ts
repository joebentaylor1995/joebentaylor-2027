// Imports
// ------------
import { mq } from '@tackl';
import { canHover } from '@utils/desktopHover';
import { waitForNavigationScene } from '@utils/navigationScene';
import { gsap } from 'gsap';
import { HERO_DESKTOP_QUERY } from '../layout';
import { type DepthSettings, depthUrl, scrollKeys } from './effect-settings';
import type { LiquidLayer } from './liquid';
import type { LiquidSettings } from './liquid-settings';
import { portraitBottomSpan } from './portrait-layout';
import { introDefaults, introSettings, sceneIntros } from './scene-intro';
import { ScrollMotion } from './scroll-motion';
import { fragment, vertex } from './shaders';

// Types
// ------------
type Uniforms = Record<string, WebGLUniformLocation | null>;

interface RendererOptions {
	canvas: HTMLCanvasElement;
	photo: HTMLImageElement;
	host: HTMLElement;
	liquidEnabled: boolean;
	liquidSettings: LiquidSettings;
	getSettings: () => DepthSettings;
	onReady: (ready: boolean) => void;
}

export interface DepthController {
	destroy: () => void;
	preview: () => void;
}

// Constants
// ------------
// Device pixel ratio caps. Keep the settled portrait sharp; the moving mobile wave uses fewer pixels.
const MAX_PIXEL_RATIO = 2;
const MOBILE_WAVE_PIXEL_RATIO = 1.5;

// NOTE • Sub-threshold motion is snapped to rest so the loop can stop drawing
const SETTLE_EPSILON = 0.0001,
	CURSOR_SPEED_EPSILON = 0.001;

// Mirrors the nose flattening that used to run per texture fetch in the shader.
// All values are fractions (0-1) of the depth map: NOSE is the ellipse centre and
// half-size, FACE_COLUMNS are the two columns sampled to find the surrounding face depth.
const NOSE = { x: 0.46, y: 0.322, w: 0.026, h: 0.052 },
	FACE_COLUMNS = [0.426, 0.493];

// Helpers
// ------------
function smoothstep(edge0: number, edge1: number, x: number) {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

// Hands the main thread back between heavy setup steps, so the WebGL start-up
// is several short tasks rather than one long one
const yieldToMain = () => new Promise(resolve => setTimeout(resolve, 0));

// Bakes the corrected depth once, so each ray-march step costs one fetch instead of three.
// Returns a single-channel (0-255) map that is uploaded as a LUMINANCE texture.
function bakeDepth(source: HTMLImageElement) {
	// Read the map's pixels back through a throwaway 2D canvas
	const width = source.naturalWidth,
		height = source.naturalHeight;
	const context = Object.assign(document.createElement('canvas'), { width, height }).getContext('2d', {
		willReadFrequently: true,
	});
	if (!context) throw new Error('Unable to read depth map');
	context.drawImage(source, 0, 0);

	const rgba = context.getImageData(0, 0, width, height).data;
	const depth = new Uint8Array(width * height);

	// Bilinearly sampled red channel at normalised column `u` on pixel row `row`
	const column = (u: number, row: number) => {
		const x = Math.max(0, Math.min(width - 1, u * width - 0.5)),
			left = Math.floor(x),
			right = Math.min(width - 1, left + 1);
		return rgba[(row * width + left) * 4] * (1 - (x - left)) + rgba[(row * width + right) * 4] * (x - left);
	};
	// NOTE • Only pixels inside the small nose ellipse are reshaped; everything
	// else is the red channel as-is. Copying first and then visiting just the
	// ellipse's rows and columns keeps this to a few ms on a phone instead of a
	// Math.hypot per pixel across the whole 1.5MP map — the output is identical.
	for (let i = 0; i < depth.length; i++) depth[i] = rgba[i * 4];

	const top = Math.max(0, Math.floor((NOSE.y - NOSE.h) * height)),
		bottom = Math.min(height - 1, Math.ceil((NOSE.y + NOSE.h) * height));

	for (let y = top; y <= bottom; y++) {
		const noseY = ((y + 0.5) / height - NOSE.y) / NOSE.h;
		if (Math.abs(noseY) >= 1) continue;

		// Depth of the face either side of the nose on this row, and the ellipse's half-width here
		const face = (column(FACE_COLUMNS[0], y) + column(FACE_COLUMNS[1], y)) / 2,
			reach = Math.sqrt(1 - noseY * noseY) * NOSE.w,
			left = Math.max(0, Math.floor((NOSE.x - reach) * width) - 1),
			right = Math.min(width - 1, Math.ceil((NOSE.x + reach) * width) + 1);

		for (let x = left; x <= right; x++) {
			const z = rgba[(y * width + x) * 4],
				distance = Math.hypot(((x + 0.5) / width - NOSE.x) / NOSE.w, noseY);
			// Pull the nose back toward the face depth, strongest at the ellipse centre
			if (distance < 1)
				depth[y * width + x] = Math.round(
					z - Math.max(z - face, 0) * (1 - smoothstep(0.35, 1, distance)) * 0.85
				);
		}
	}
	return { depth, width, height };
}

// Renderer lifecycle
// ------------
// ANCHOR • Mounts the hero's WebGL depth-parallax portrait on `canvas` and returns a
// controller. Sequence: bake the depth map and compile the shader (each in its own task,
// after the navigation wave has finished) -> `initialize()` uploads textures and draws a
// first frame -> `onReady(true)` -> the optional liquid layer starts. From then on a GSAP
// ticker calls `draw()` every frame, which is paused whenever nothing visible can change.
export function mountDepthEffect({
	canvas,
	photo,
	host,
	liquidEnabled,
	liquidSettings,
	getSettings,
	onReady,
}: RendererOptions): DepthController {
	const context = canvas.getContext('webgl', {
		alpha: true,
		premultipliedAlpha: true,
		antialias: false,
		powerPreference: 'low-power',
	});
	if (!context) return { destroy() {}, preview() {} };
	const gl: WebGLRenderingContext = context;
	const bindProgram = gl.useProgram.bind(gl);

	// GPU resources are tracked so destroy() (and context restore) can release them
	const buffers: WebGLBuffer[] = [],
		textures: WebGLTexture[] = [],
		programs: WebGLProgram[] = [];
	const events = new AbortController();

	// Lifecycle flags. `dirty` means the next frame must actually be drawn; `lost` is a lost GL context
	let disposed = false,
		loaded = false,
		visible = true,
		lost = false,
		dirty = true;
	let cssWidth = canvas.clientWidth,
		cssHeight = canvas.clientHeight,
		lastSettings: DepthSettings | null = null;
	let lastIntroTint = -1;

	// Pointer state. `target`/`pointer` are the -1..1 parallax offset (goal and eased value);
	// `cursor` is the raw 0..1 position over the canvas that drives the cursor glow
	let target = [0, 0],
		pointer = [0, 0],
		cursor = [0.5, 0.5],
		previousCursor = [0.5, 0.5];
	let cursorActive = 0,
		cursorSpeed = 0;
	const scroll = new ScrollMotion(getSettings);

	// Assets and GL objects, assigned once initialize() has run
	let colourImage: HTMLImageElement | null = null;
	let bakedDepth: ReturnType<typeof bakeDepth>;
	let main: Awaited<ReturnType<typeof makeProgram>>;
	const scrollValues = new Float32Array(scrollKeys.length);
	let liquid: LiquidLayer | null = null;
	let quad: WebGLBuffer;
	let photoTexture: WebGLTexture, depthTexture: WebGLTexture;
	let colourTexture: WebGLTexture;

	// Bumped to invalidate in-flight async work (initialize / startLiquid) after a restart or teardown
	let generation = 0;
	let liquidResize = false;

	// SECTION • Liquid layer and GL setup helpers
	// Tears the liquid layer down and points rendering back at the canvas
	function stopLiquid() {
		liquid?.destroy();
		liquid = null;
		delete host.dataset.liquidReady;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		dirty = true;
	}

	// Re-binds the portrait program, quad and its three textures (0 photo, 1 depth, 2 colour).
	// The liquid passes bind their own programs, so this runs again after they draw.
	function bindPortrait() {
		bindProgram(main.program);
		gl.bindBuffer(gl.ARRAY_BUFFER, quad);
		const position = main.position;
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, photoTexture);
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, depthTexture);
		gl.activeTexture(gl.TEXTURE2);
		gl.bindTexture(gl.TEXTURE_2D, colourTexture);
	}

	// Loads the logo images, then builds the liquid layer on the same GL context. Safe to call
	// again (logo markup changes): `generation` makes any earlier call abandon itself.
	async function startLiquid() {
		if (!liquidEnabled) return;
		const current = ++generation;
		try {
			const images = desktopLayout.matches
				? Array.from(host.querySelectorAll<HTMLImageElement>('[data-logo-track] img'))
				: [];
			// The desktop strip needs offscreen logos too; mobile retains native lazy loading.
			for (const image of images) image.loading = 'eager';

			await Promise.all(
				images.map(image =>
					image.complete && image.naturalWidth
						? image.decode()
						: new Promise<void>((resolve, reject) => {
								image.addEventListener('load', () => resolve(), { once: true, signal: events.signal });
								image.addEventListener('error', () => reject(new Error('Logo image failed')), {
									once: true,
									signal: events.signal,
								});
							})
				)
			);

			// The layer is code-split; fonts and the page-transition wave must settle before it
			// rasterises the hero text into its scene texture
			const { createLiquidLayer } = await import('./liquid');
			await document.fonts.ready;
			await waitForNavigationScene(events.signal);
			if (disposed || lost || current !== generation) return;

			stopLiquid();
			const layer = await createLiquidLayer(
				gl,
				canvas,
				host,
				liquidSettings,
				() => disposed || lost || current !== generation
			);
			if (disposed || lost || current !== generation) {
				layer.destroy();
				return;
			}
			liquid = layer;
			dirty = true;
		} catch {
			// The enhancement is optional: retain the portrait and HTML marquee on failure.
			if (!disposed && !lost && current === generation) stopLiquid();
		}
	}

	// Drops all pointer and scroll motion back to rest (used when the hero is hidden or paused)
	function resetMotion() {
		liquid?.resetPointer();
		scroll.reset();
		target = [0, 0];
		dirty = true;
	}

	// Feeds a scroll/wheel/touch delta (px) into the scroll-driven effects
	function kick(delta: number) {
		if (!visible || document.hidden) return;
		scroll.add(delta);
		dirty = true;
	}

	// Compiles and links a program without blocking: polls every 16ms (and uses
	// KHR_parallel_shader_compile where available) so the main thread isn't held during link.
	// Resolves with the uniform locations for `names`.
	async function makeProgram(v: string, f: string, names: string[]) {
		const parallel = gl.getExtension('KHR_parallel_shader_compile');
		const program = gl.createProgram();
		if (!program) throw new Error('Unable to create depth program');
		programs.push(program);
		for (const [type, source] of [
			[gl.VERTEX_SHADER, v],
			[gl.FRAGMENT_SHADER, f],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Unable to create depth shader');
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			gl.attachShader(program, shader);
			gl.deleteShader(shader);
		}
		gl.linkProgram(program);

		do {
			await new Promise(resolve => setTimeout(resolve, 16));
			if (disposed || lost) throw new Error('Depth initialization cancelled');
		} while (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR));
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(gl.getProgramInfoLog(program) || 'Depth program link failed');

		const uniforms: Uniforms = {};
		for (const name of names) uniforms[name] = gl.getUniformLocation(program, name);
		return { program, uniforms, position: gl.getAttribLocation(program, 'position') };
	}

	function makeBuffer(data: Float32Array) {
		const buffer = gl.createBuffer();
		if (!buffer) throw new Error('Unable to allocate depth buffer');
		buffers.push(buffer);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
		return buffer;
	}

	// Creates a linear-filtered, edge-clamped texture on `unit`; `upload` supplies the pixels
	function texture(unit: number, upload: () => void) {
		const t = gl.createTexture();
		if (!t) throw new Error('Unable to allocate depth texture');
		textures.push(t);
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, t);

		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

		upload();
		return t;
	}

	// Uniforms shared by every frame: canvas size, parallax motion and the portrait crop.
	// Percent settings (positionX/Y) become fractions here.
	function commonUniforms(u: Uniforms, s: DepthSettings) {
		gl.uniform2f(u.resolution, canvas.width, canvas.height);
		gl.uniform1f(u.portraitAspect, photo.naturalWidth / photo.naturalHeight);
		gl.uniform2f(u.motion, pointer[0] * s.horizontal, pointer[1] * s.vertical);

		const mobile = !desktopLayout.matches;
		const small = smallScreenPortrait(s);
		// CSS fallback scales around centre bottom; shaders rotate around centre.
		gl.uniform2f(
			u.positionShift,
			mobile ? small.x / 100 : s.positionX / 100,
			mobile ? small.y / 100 + (1 - small.zoom) / 2 : s.positionY / 100
		);
		for (const key of ['intensity', 'lift'] as const) gl.uniform1f(u[key], s[key]);
		gl.uniform1f(u.zoom, mobile ? small.zoom : s.zoom);
		gl.uniform1f(u.rotation, ((mobile ? small.rotation : s.rotation) * Math.PI) / 180);
	}

	// SECTION • Layout queries and frame-loop gating
	const desktopLayout = window.matchMedia(HERO_DESKTOP_QUERY);
	const tabletLayout = window.matchMedia(mq.up.m);

	// Below the desktop layout, tablets have their own crop
	const smallScreenPortrait = (s: DepthSettings) =>
		tabletLayout.matches
			? { x: s.tabletPositionX, y: s.tabletPositionY, zoom: s.tabletZoom, rotation: s.tabletRotation }
			: { x: s.mobilePositionX, y: s.mobilePositionY, zoom: s.mobileZoom, rotation: s.mobileRotation };
	const profileScene = host.closest<HTMLElement>('[data-profile-scene]');

	// The page-transition wave only pauses the loop once this hero has painted at least once
	let hasPresented = false;
	const navigationPaused = () =>
		hasPresented && document.documentElement.matches('[data-navigation-pending], [data-navigation-wave]');

	// Adds or removes `draw` from the GSAP ticker so no frames run while the hero is
	// unloaded, offscreen, hidden, covered by a navigation, or its profile scene is paused
	function syncTicker() {
		gsap.ticker.remove(draw);
		if (
			loaded &&
			!disposed &&
			!lost &&
			visible &&
			!document.hidden &&
			!navigationPaused() &&
			profileScene?.dataset.scenePaused !== 'true'
		)
			gsap.ticker.add(draw);
	}

	const pauseObserver = new MutationObserver(() => {
		if (profileScene?.dataset.scenePaused === 'true') resetMotion();
		syncTicker();
	});
	if (profileScene) pauseObserver.observe(profileScene, { attributes: true, attributeFilter: ['data-scene-paused'] });
	pauseObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ['data-navigation-pending', 'data-navigation-wave'],
	});

	// SECTION • Frame loop
	// ANCHOR • One frame, called by the GSAP ticker with the frame delta in ms. Order: size the
	// canvas, ease the pointer, step scroll motion, skip the frame if everything is at rest,
	// otherwise upload uniforms and draw the portrait, then let the liquid layer draw on top.
	function draw(_time: number, deltaMs: number) {
		// Same conditions as syncTicker, re-checked in case a state change landed mid-frame
		if (
			!loaded ||
			disposed ||
			lost ||
			!visible ||
			document.hidden ||
			navigationPaused() ||
			profileScene?.dataset.scenePaused === 'true'
		)
			return;
		try {
			// dt is in seconds, clamped to 50ms so a stalled tab doesn't jump on return
			const now = performance.now(),
				dt = Math.min(deltaMs / 1000, 0.05) || 0.016,
				s = getSettings();
			// `entering` = the intro water wave is still revealing the portrait
			const entering = (sceneIntros.get(host)?.waterReveal ?? 1) < 1;
			const dpr = Math.min(
				devicePixelRatio,
				!desktopLayout.matches && entering ? MOBILE_WAVE_PIXEL_RATIO : MAX_PIXEL_RATIO
			);
			const w = Math.max(1, Math.round(cssWidth * dpr)),
				h = Math.max(1, Math.round(cssHeight * dpr));

			// Resize the drawing buffer and tell the liquid layer to rebuild its targets
			if (canvas.width !== w || canvas.height !== h) {
				canvas.width = w;
				canvas.height = h;
				gl.viewport(0, 0, w, h);
				liquidResize = true;
				dirty = true;
			}

			if (liquid && liquidResize) {
				try {
					liquid.resize();
				} catch {
					stopLiquid();
				}
				liquidResize = false;
				dirty = true;
			}

			// A new settings object (from the settings panel) means redraw
			if (s !== lastSettings) {
				lastSettings = s;
				dirty = true;
			}

			// No pointer parallax until the intro wave has landed
			if (entering) {
				target = [0, 0];
				pointer = [0, 0];
				cursorActive = 0;
				cursorSpeed = 0;
				previousCursor = [...cursor];
				liquid?.resetPointer();
			}

			// Where the parallax is heading: rest while entering, a slow Lissajous drift in
			// auto mode, otherwise the pointer. Eased framerate-independently (smooth is per 60fps frame).
			const dest = entering
				? [0, 0]
				: s.auto
					? [Math.sin(now * 0.00055) * 0.8, Math.cos(now * 0.00043) * 0.55]
					: target;
			const ease = 1 - s.smooth ** (dt * 60);
			pointer = pointer.map((v, i) => v + (dest[i] - v) * ease);

			// Cursor speed (0..1) rises instantly with movement and decays over ~0.15s
			cursorSpeed = Math.max(
				Math.min(1, (Math.hypot(cursor[0] - previousCursor[0], cursor[1] - previousCursor[1]) / dt) * 0.5),
				cursorSpeed * Math.exp(-dt * 7)
			);
			previousCursor = [...cursor];
			scroll.step(dt);

			// Cache the full-colour portrait during the fade; the final pass desaturates it.
			const introTint = (sceneIntros.get(host)?.colour ?? 0) > 0 ? 1 : 0;
			if (introTint !== lastIntroTint) dirty = true;

			// Settled = intro finished and every moving part is within epsilon of rest
			const settled =
				(sceneIntros.get(host)?.waterReveal ?? 1) === 1 &&
				(sceneIntros.get(host)?.portrait ?? 1) === 1 &&
				!s.auto &&
				scroll.settled &&
				cursorSpeed < CURSOR_SPEED_EPSILON &&
				Math.abs(pointer[0] - dest[0]) < SETTLE_EPSILON &&
				Math.abs(pointer[1] - dest[1]) < SETTLE_EPSILON;
			// Idle frames are identical, so skip them; one last draw lands the snapped rest pose
			if (settled && !dirty) {
				if (liquid) {
					try {
						liquid.draw(dt, scroll.velocity, scroll.gesture);
					} catch {
						stopLiquid();
					}
					bindPortrait();
				}
				return;
			}
			dirty = !settled;
			if (settled) {
				pointer = [...dest];
				cursorSpeed = 0;
			}

			// Per-effect scroll strengths; all zero in depth-debug view or when an effect is off
			scrollKeys.forEach((key, i) => {
				scrollValues[i] = !s.depth && s[`${key}On`] ? s[key] : 0;
			});

			// Draw the portrait into the liquid layer's scene texture, or straight to the canvas
			const u = main.uniforms;
			bindPortrait();
			if (liquid) liquid.beginPortrait();
			else {
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, canvas.width, canvas.height);
			}
			commonUniforms(u, s);

			// Intro: `entrance` is the portrait's own reveal (0..1), `reveal` the water wave's (0..1)
			const entrance = sceneIntros.get(host)?.portrait ?? 1;
			const reveal = sceneIntros.get(host)?.waterReveal ?? 1;
			// Let the portrait land softly while the ripple continues out to the edges.
			const introConfig = introSettings.get(host) ?? introDefaults;
			const settleProgress = Math.min(1, reveal / (introConfig.portraitFinish / 100));
			const scaleEase = gsap.parseEase(introConfig.portraitEase)(settleProgress);

			// Keep tall windows from enlarging the portrait into the text column.
			// Zoom and position are overridden from commonUniforms to blend in the intro scale.
			if (desktopLayout.matches) {
				const portraitAspect = photo.naturalWidth / photo.naturalHeight;
				const coverWidth = Math.max(cssWidth, cssHeight * portraitAspect);
				const widthScale = cssWidth / coverWidth;
				const bottomSpan = cssWidth * portraitBottomSpan(s, portraitAspect);
				const bottomOffset = Math.max(0, (cssHeight - bottomSpan) / 2);
				gl.uniform2f(u.positionShift, s.positionX / 100, s.positionY / 100 + bottomOffset / cssHeight);
				gl.uniform1f(
					u.zoom,
					(introConfig.portraitScale + (s.zoom - introConfig.portraitScale) * scaleEase) * widthScale
				);
			} else {
				const small = smallScreenPortrait(s);
				const zoom = introConfig.portraitScale + (small.zoom - introConfig.portraitScale) * scaleEase;
				gl.uniform1f(u.zoom, zoom);
				gl.uniform2f(u.positionShift, small.x / 100, small.y / 100 + (1 - zoom) / 2);
			}

			gl.uniform1f(u.entrance, entrance);
			gl.uniform2f(u.cursorPos, cursor[0], cursor[1]);
			gl.uniform1f(u.cursorOn, cursorActive);
			gl.uniform1f(u.cursorSpeed, cursorSpeed);
			gl.uniform1f(u.chromaFX, s.chromaOn ? s.chroma : 0);
			gl.uniform1f(u.glowFX, s.glowOn ? s.glow : 0);
			gl.uniform1f(u.debug, s.depth ? 1 : 0);
			gl.uniform1fv(u['scrollFX[0]'], scrollValues);
			gl.uniform1f(u.scrollVelocity, scroll.pulse);
			gl.uniform1f(u.colourMix, colourImage ? scroll.colour + (1 - scroll.colour) * introTint : 0);
			lastIntroTint = introTint;

			gl.drawArrays(gl.TRIANGLES, 0, 6);
			hasPresented = true;

			// The liquid layer composites the scene texture to the canvas; a failure drops back to the portrait
			if (liquid) {
				try {
					liquid.draw(dt, scroll.velocity, scroll.gesture);
				} catch {
					stopLiquid();
				}
				bindPortrait();
			}
		} catch (error) {
			stopLiquid();
			loaded = false;
			onReady(false);
			console.error('Hero depth effect:', error);
		}
	}

	// SECTION • Input
	// True for events on interactive UI inside the hero (links, buttons, settings panels),
	// which should not drive the water or scroll effects
	function ignored(event: Event) {
		return (
			event.target instanceof Element &&
			!!event.target.closest('a, button, input, textarea, select, [data-hero-settings], [data-liquid-controls]')
		);
	}

	// Maps a mouse position to parallax (-1..1) and water-cursor (0..1) coordinates
	function track(event: PointerEvent) {
		if (!canHover() || event.pointerType !== 'mouse') return;
		// Depth and water cursor become available together once the ripple lands.
		if ((sceneIntros.get(host)?.waterReveal ?? 1) < 1) {
			liquid?.resetPointer();
			return;
		}
		const r = canvas.getBoundingClientRect();
		const wasActive = cursorActive;
		cursor = [(event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height];
		if (!wasActive) previousCursor = [...cursor];
		cursorActive = 1;
		target = cursor.map(v => Math.max(-1, Math.min(1, v * 2 - 1)));
		if (!ignored(event)) liquid?.move(cursor[0], cursor[1]);
		else liquid?.resetPointer();
		dirty = true;
	}
	host.addEventListener('pointermove', track, { signal: events.signal });

	// The header sits above the hero, so pointer moves over it are forwarded while inside the canvas bounds
	window.addEventListener(
		'pointermove',
		event => {
			if (!(event.target instanceof Element) || !event.target.closest('header')) return;
			const bounds = canvas.getBoundingClientRect();
			if (!bounds.width || !bounds.height || event.clientY < bounds.top || event.clientY > bounds.bottom) return;
			track(event);
			if (canHover() && event.pointerType === 'mouse' && (sceneIntros.get(host)?.waterReveal ?? 1) === 1)
				liquid?.move(
					(event.clientX - bounds.left) / bounds.width,
					(event.clientY - bounds.top) / bounds.height
				);
		},
		{ signal: events.signal }
	);
	host.addEventListener(
		'pointerleave',
		() => {
			target = [0, 0];
			cursorActive = 0;
			liquid?.resetPointer();
			dirty = true;
		},
		{ signal: events.signal }
	);

	// Wheel and touch drag feed the scroll effects. Wheel deltas are normalised to px
	// (deltaMode 1 = lines at 16px each, 2 = pages); ctrl+wheel is a pinch-zoom and ignored.
	host.addEventListener(
		'wheel',
		event => {
			if (!event.ctrlKey && !ignored(event))
				kick(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1));
		},
		{ passive: true, signal: events.signal }
	);

	// Last touch Y (px) while one finger is down on the hero, else null
	let touchY: number | null = null;
	host.addEventListener(
		'pointerdown',
		event => {
			if (ignored(event) || !event.isPrimary || event.button !== 0) return;
			track(event);
		},
		{ signal: events.signal }
	);
	host.addEventListener(
		'touchmove',
		event => {
			if (event.touches.length === 1 && touchY !== null) {
				kick((touchY - event.touches[0].clientY) * 3);
				touchY = event.touches[0].clientY;
			}
		},
		{ passive: true, signal: events.signal }
	);
	host.addEventListener(
		'touchend',
		() => {
			touchY = null;
		},
		{ signal: events.signal }
	);
	host.addEventListener(
		'touchcancel',
		() => {
			touchY = null;
		},
		{ signal: events.signal }
	);
	// Touch events continue after the browser takes over native scrolling.
	host.addEventListener(
		'touchstart',
		event => {
			touchY = !ignored(event) && event.touches.length === 1 ? event.touches[0].clientY : null;
		},
		{ passive: true, signal: events.signal }
	);

	// SECTION • Visibility, resize and context loss
	document.addEventListener(
		'visibilitychange',
		() => {
			if (document.hidden) resetMotion();
			syncTicker();
		},
		{ signal: events.signal }
	);

	const observer = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (!visible) resetMotion();
		syncTicker();
	});
	observer.observe(host);

	// Cached here so the frame loop never forces layout
	const resizer = new ResizeObserver(([entry]) => {
		cssWidth = entry.contentRect.width;
		cssHeight = entry.contentRect.height;
	});
	resizer.observe(canvas);

	// The liquid layer rasterises the logo marquee and hero text, so any change to them
	// (size, or webfonts finishing loading) flags a rebuild on the next frame
	const decorationResizer = new ResizeObserver(() => {
		liquidResize = true;
	});
	if (liquidEnabled) {
		for (const element of host.querySelectorAll(
			'[data-logo-marquee], [data-logo-marquee] h2, [data-logo-track], [data-hero-content], [data-hero-content] *'
		))
			decorationResizer.observe(element);
		document.fonts.addEventListener(
			'loadingdone',
			() => {
				liquidResize = true;
			},
			{ signal: events.signal }
		);
	}

	// On context loss every GL object is gone: stop drawing, and rebuild everything from scratch on restore
	canvas.addEventListener(
		'webglcontextlost',
		event => {
			event.preventDefault();
			lost = true;
			syncTicker();
			generation++;
			stopLiquid();
			onReady(false);
		},
		{ signal: events.signal }
	);
	canvas.addEventListener(
		'webglcontextrestored',
		() => {
			lost = false;
			buffers.length = textures.length = programs.length = 0;
			resetMotion();
			void initialize();
		},
		{ signal: events.signal }
	);

	// SECTION • Start-up
	// ANCHOR • Compiles the shader and uploads the three textures, spreading the work across
	// tasks. Each await is followed by a `generation` check so a restart or teardown wins.
	async function initialize() {
		const current = ++generation;
		loaded = false;
		try {
			await waitForNavigationScene(events.signal);
			if (disposed || lost || current !== generation) return;

			const compiled = await makeProgram(vertex, fragment, [
				'photo',
				'colourPhoto',
				'colourMix',
				'entrance',
				'depthMask',
				'resolution',
				'portraitAspect',
				'motion',
				'intensity',
				'lift',
				'debug',
				'positionShift',
				'rotation',
				'zoom',
				'cursorPos',
				'cursorOn',
				'cursorSpeed',
				'chromaFX',
				'glowFX',
				'scrollFX[0]',
				'scrollVelocity',
			]);
			if (disposed || lost || current !== generation) return;

			// Full-screen quad as two triangles; textures: 0 photo, 1 depth, 2 colour
			main = compiled;
			quad = makeBuffer(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
			photoTexture = texture(0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo));
			await yieldToMain();
			if (disposed || lost || current !== generation) return;
			colourTexture = texture(2, () =>
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, colourImage || photo)
			);
			await yieldToMain();
			if (disposed || lost || current !== generation) return;
			depthTexture = texture(1, () => {
				const { depth, width, height } = bakedDepth;
				gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, depth);
			});
			// Initialise the portrait attributes before the optional liquid passes.
			bindProgram(main.program);
			const position = main.position;
			gl.enableVertexAttribArray(position);
			gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
			gl.uniform1i(main.uniforms.photo, 0);
			gl.uniform1i(main.uniforms.colourPhoto, 2);
			gl.uniform1i(main.uniforms.depthMask, 1);

			// Draw one frame immediately so the portrait is on screen before onReady fires
			loaded = true;
			syncTicker();
			dirty = true;
			draw(0, 16);
			if (loaded) onReady(true);
			if (loaded) void startLiquid();
		} catch (error) {
			if (disposed || lost || current !== generation) return;
			loaded = false;
			onReady(false);
			console.error('Hero depth initialization:', error);
		}
	}

	const load = (url: string) =>
		new Promise<HTMLImageElement>((resolve, reject) => {
			const img = new Image();
			img.onload = () => resolve(img);
			img.onerror = reject;
			img.src = url;
		});
	// Reuse the fallback <img>: it's already the right size for this screen and in cache
	const photoReady =
		photo.complete && photo.naturalWidth
			? Promise.resolve()
			: new Promise<void>((resolve, reject) => {
					photo.addEventListener('load', () => resolve(), { once: true, signal: events.signal });
					photo.addEventListener('error', reject, { once: true, signal: events.signal });
				});

	// Kick everything off: photo, depth map and (optional) colour portrait load in parallel
	Promise.all([
		photoReady.then(() => photo.decode()),
		load(depthUrl),
		load('/images/hero-depth/portrait-colour.webp').catch(() => null),
	])
		.then(async ([, depth, colour]) => {
			if (disposed) return;
			colourImage = colour;
			// The bake decodes the whole depth map, so it waits for the wave like the GPU work
			await waitForNavigationScene(events.signal);
			if (disposed) return;
			bakedDepth = bakeDepth(depth);
			// The bake and the shader compile each get their own task
			return yieldToMain().then(() => {
				if (!disposed) void initialize();
			});
		})
		.catch(() => {
			if (!disposed) onReady(false);
		});

	// SECTION • Keeping the liquid texture in sync with the DOM
	// CMS/React changes to the shared logo markup refresh the desktop texture too.
	const logoTrack = host.querySelector('[data-logo-marquee]');
	const logoObserver = new MutationObserver(() => {
		if (loaded && !lost) void startLiquid();
	});
	if (liquidEnabled && logoTrack)
		logoObserver.observe(logoTrack, {
			childList: true,
			subtree: true,
			attributes: true,
			characterData: true,
			attributeFilter: ['src', 'srcset', 'width', 'height', 'class', 'style'],
		});

	// Theme, class and style changes re-rasterise the hero text, except the inline-style
	// writes made while the entrance animation is running
	const themeObserver = new MutationObserver(records => {
		if (
			records.every(
				record =>
					record.type === 'attributes' &&
					record.attributeName === 'style' &&
					(record.target as Element).closest('[data-entrance="running"]')
			)
		)
			return;
		liquidResize = true;
	});

	const content = host.querySelector('[data-hero-content]');
	if (liquidEnabled && content)
		themeObserver.observe(content, {
			subtree: true,
			childList: true,
			characterData: true,
			attributes: true,
			attributeFilter: ['class', 'style', 'data-type', 'd'],
		});
	if (liquidEnabled)
		for (const element of [document.documentElement, document.body, host])
			themeObserver.observe(element, { attributes: true, attributeFilter: ['class', 'style'] });

	// preview() resets motion and gives the scroll effects a 500px nudge; destroy() releases everything
	return {
		preview() {
			resetMotion();
			kick(500);
		},
		destroy() {
			disposed = true;
			generation++;
			stopLiquid();
			logoObserver.disconnect();
			pauseObserver.disconnect();
			decorationResizer.disconnect();
			themeObserver.disconnect();
			gsap.ticker.remove(draw);
			events.abort();
			observer.disconnect();
			resizer.disconnect();
			for (const b of buffers) gl.deleteBuffer(b);
			for (const t of textures) gl.deleteTexture(t);
			for (const p of programs) gl.deleteProgram(p);
		},
	};
}
