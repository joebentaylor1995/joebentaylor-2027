// Imports
// ------------
import { gsap } from 'gsap';
import { type DepthSettings, depthUrl, scrollKeys } from './effect-settings';
import type { LiquidLayer } from './liquid';
import type { LiquidSettings } from './liquid-settings';
import { introDefaults, introSettings, sceneIntros } from './scene-intro';
import { ScrollMotion } from './scroll-motion';
import { fragment, vertex } from './shaders';

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

// NOTE • Fewer pixels for the 48-step ray march; the portrait is soft enough
// that retina screens can't tell 1.5 from 2
const MAX_PIXEL_RATIO = 1.5;
// NOTE • Sub-threshold motion is snapped to rest so the loop can stop drawing
const SETTLE_EPSILON = 0.0001,
	CURSOR_SPEED_EPSILON = 0.001;

// Mirrors the nose flattening that used to run per texture fetch in the shader
const NOSE = { x: 0.46, y: 0.322, w: 0.026, h: 0.052 },
	FACE_COLUMNS = [0.426, 0.493];

function smoothstep(edge0: number, edge1: number, x: number) {
	const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
	return t * t * (3 - 2 * t);
}

// Bakes the corrected depth once, so each ray-march step costs one fetch instead of three
function bakeDepth(source: HTMLImageElement) {
	const width = source.naturalWidth,
		height = source.naturalHeight;
	const context = Object.assign(document.createElement('canvas'), { width, height }).getContext('2d', {
		willReadFrequently: true,
	});
	if (!context) throw new Error('Unable to read depth map');
	context.drawImage(source, 0, 0);
	const rgba = context.getImageData(0, 0, width, height).data;
	const depth = new Uint8Array(width * height);
	const column = (u: number, row: number) => {
		const x = Math.max(0, Math.min(width - 1, u * width - 0.5)),
			left = Math.floor(x),
			right = Math.min(width - 1, left + 1);
		return rgba[(row * width + left) * 4] * (1 - (x - left)) + rgba[(row * width + right) * 4] * (x - left);
	};
	for (let y = 0; y < height; y++) {
		const face = (column(FACE_COLUMNS[0], y) + column(FACE_COLUMNS[1], y)) / 2,
			noseY = ((y + 0.5) / height - NOSE.y) / NOSE.h;
		for (let x = 0; x < width; x++) {
			const z = rgba[(y * width + x) * 4],
				distance = Math.hypot(((x + 0.5) / width - NOSE.x) / NOSE.w, noseY);
			depth[y * width + x] =
				distance < 1 ? Math.round(z - Math.max(z - face, 0) * (1 - smoothstep(0.35, 1, distance)) * 0.85) : z;
		}
	}
	return { depth, width, height };
}

// Renderer lifecycle
// ------------
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
	const buffers: WebGLBuffer[] = [],
		textures: WebGLTexture[] = [],
		programs: WebGLProgram[] = [];
	const events = new AbortController();
	let disposed = false,
		loaded = false,
		visible = true,
		lost = false,
		dirty = true;
	let cssWidth = canvas.clientWidth,
		cssHeight = canvas.clientHeight,
		lastSettings: DepthSettings | null = null;
	let target = [0, 0],
		pointer = [0, 0],
		cursor = [0.5, 0.5],
		previousCursor = [0.5, 0.5];
	let cursorActive = 0,
		cursorSpeed = 0;
	const scroll = new ScrollMotion(getSettings);
	let colourImage: HTMLImageElement | null = null;
	let bakedDepth: ReturnType<typeof bakeDepth>;
	let main: Awaited<ReturnType<typeof makeProgram>>;
	const scrollValues = new Float32Array(scrollKeys.length);
	let liquid: LiquidLayer | null = null;
	let quad: WebGLBuffer;
	let photoTexture: WebGLTexture, depthTexture: WebGLTexture;
	let colourTexture: WebGLTexture;
	let generation = 0;
	let liquidResize = false;

	function stopLiquid() {
		liquid?.destroy();
		liquid = null;
		delete host.dataset.liquidReady;
		gl.bindFramebuffer(gl.FRAMEBUFFER, null);
		gl.viewport(0, 0, canvas.width, canvas.height);
		dirty = true;
	}
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
	async function startLiquid() {
		if (!liquidEnabled) return;
		const current = ++generation;
		try {
			const images = Array.from(host.querySelectorAll<HTMLImageElement>('[data-logo-track] img'));
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
			const { createLiquidLayer } = await import('./liquid');
			await document.fonts.ready;
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

	function resetMotion() {
		liquid?.resetPointer();
		scroll.reset();
		target = [0, 0];
		dirty = true;
	}
	function kick(delta: number) {
		if (!visible || document.hidden) return;
		scroll.add(delta);
		dirty = true;
	}
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
	function commonUniforms(u: Uniforms, s: DepthSettings) {
		gl.uniform2f(u.resolution, canvas.width, canvas.height);
		gl.uniform2f(u.motion, pointer[0] * s.horizontal, pointer[1] * s.vertical);
		gl.uniform2f(u.positionShift, s.positionX / 100, s.positionY / 100);
		for (const key of ['intensity', 'lift', 'zoom'] as const) gl.uniform1f(u[key], s[key]);
		gl.uniform1f(u.rotation, (s.rotation * Math.PI) / 180);
	}
	function draw(_time: number, deltaMs: number) {
		if (!loaded || disposed || lost || !visible || document.hidden) return;
		try {
			const now = performance.now(),
				dt = Math.min(deltaMs / 1000, 0.05) || 0.016,
				s = getSettings();
			const dpr = Math.min(devicePixelRatio, MAX_PIXEL_RATIO);
			const w = Math.max(1, Math.round(cssWidth * dpr)),
				h = Math.max(1, Math.round(cssHeight * dpr));
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
			if (s !== lastSettings) {
				lastSettings = s;
				dirty = true;
			}
			const entering = host.querySelector('[data-hero-content]')?.getAttribute('data-entrance') === 'running';
			if (entering) {
				target = [0, 0];
				pointer = [0, 0];
				cursorActive = 0;
				cursorSpeed = 0;
				previousCursor = [...cursor];
				liquid?.resetPointer();
			}
			const dest = entering
				? [0, 0]
				: s.auto
					? [Math.sin(now * 0.00055) * 0.8, Math.cos(now * 0.00043) * 0.55]
					: target;
			const ease = 1 - s.smooth ** (dt * 60);
			pointer = pointer.map((v, i) => v + (dest[i] - v) * ease);
			cursorSpeed = Math.max(
				Math.min(1, (Math.hypot(cursor[0] - previousCursor[0], cursor[1] - previousCursor[1]) / dt) * 0.5),
				cursorSpeed * Math.exp(-dt * 7)
			);
			previousCursor = [...cursor];
			scroll.step(dt);
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
			scrollKeys.forEach((key, i) => {
				scrollValues[i] = !s.depth && s[`${key}On`] ? s[key] : 0;
			});
			const u = main.uniforms;
			bindPortrait();
			if (liquid) liquid.beginPortrait();
			else {
				gl.bindFramebuffer(gl.FRAMEBUFFER, null);
				gl.viewport(0, 0, canvas.width, canvas.height);
			}
			commonUniforms(u, s);
			const entrance = sceneIntros.get(host)?.portrait ?? 1;
			const reveal = sceneIntros.get(host)?.waterReveal ?? 1;
			// Let the portrait land softly while the ripple continues out to the edges.
			const introConfig = introSettings.get(host) ?? introDefaults;
			const settleProgress = Math.min(1, reveal / (introConfig.portraitFinish / 100));
			const scaleEase = gsap.parseEase(introConfig.portraitEase)(settleProgress);
			// Freeze width-driven cover sizing at the configured CSS viewport width.
			// Height-driven cover sizing stays intact on tall screens.
			const portraitAspect = 1.4455;
			const coverWidth = Math.max(cssWidth, cssHeight * portraitAspect);
			const cappedWidth = Math.max(Math.min(cssWidth, s.maxWidth), cssHeight * portraitAspect);
			const widthScale = cappedWidth / coverWidth;
			gl.uniform1f(
				u.zoom,
				(introConfig.portraitScale + (s.zoom - introConfig.portraitScale) * scaleEase) * widthScale
			);
			gl.uniform1f(u.entrance, entrance);
			gl.uniform2f(u.cursorPos, cursor[0], cursor[1]);
			gl.uniform1f(u.cursorOn, cursorActive);
			gl.uniform1f(u.cursorSpeed, cursorSpeed);
			gl.uniform1f(u.chromaFX, s.chromaOn ? s.chroma : 0);
			gl.uniform1f(u.glowFX, s.glowOn ? s.glow : 0);
			gl.uniform1f(u.debug, s.depth ? 1 : 0);
			gl.uniform1fv(u['scrollFX[0]'], scrollValues);
			gl.uniform1f(u.scrollVelocity, scroll.pulse);
			gl.uniform1f(u.colourMix, colourImage ? scroll.colour : 0);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
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
	function ignored(event: Event) {
		return (
			event.target instanceof Element &&
			!!event.target.closest('a, button, input, textarea, select, [data-hero-settings], [data-liquid-controls]')
		);
	}
	function track(event: PointerEvent) {
		// Do not collect pointer impulses against moving intro geometry. The first
		// post-intro event starts a fresh fluid stroke rather than joining a stale point.
		if (host.querySelector('[data-hero-content]')?.getAttribute('data-entrance') === 'running') {
			liquid?.resetPointer();
			return;
		}
		const r = canvas.getBoundingClientRect();
		const wasActive = cursorActive;
		cursor = [(event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height];
		if (!wasActive) previousCursor = [...cursor];
		cursorActive = 1;
		target = cursor.map(v => Math.max(-1, Math.min(1, v * 2 - 1)));
		if (event.pointerType !== 'touch' && !ignored(event)) liquid?.move(cursor[0], cursor[1]);
		else liquid?.resetPointer();
		dirty = true;
	}
	host.addEventListener('pointermove', track, { signal: events.signal });
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
	host.addEventListener(
		'wheel',
		event => {
			if (!event.ctrlKey && !ignored(event))
				kick(event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.clientHeight : 1));
		},
		{ passive: true, signal: events.signal }
	);
	let touchY: number | null = null;
	host.addEventListener(
		'pointerdown',
		event => {
			if (ignored(event) || !event.isPrimary || event.button !== 0) return;
			track(event);
			if (event.pointerType === 'touch') touchY = event.clientY;
		},
		{ signal: events.signal }
	);
	host.addEventListener(
		'pointermove',
		event => {
			if (event.pointerType === 'touch' && touchY !== null) {
				kick((touchY - event.clientY) * 3);
				touchY = event.clientY;
			}
		},
		{ passive: true, signal: events.signal }
	);
	host.addEventListener(
		'pointerup',
		() => {
			touchY = null;
		},
		{ signal: events.signal }
	);
	host.addEventListener(
		'pointercancel',
		() => {
			touchY = null;
		},
		{ signal: events.signal }
	);
	document.addEventListener(
		'visibilitychange',
		() => {
			if (document.hidden) resetMotion();
		},
		{ signal: events.signal }
	);
	const observer = new IntersectionObserver(([entry]) => {
		visible = entry.isIntersecting;
		if (!visible) resetMotion();
	});
	observer.observe(host);
	// Cached here so the frame loop never forces layout
	const resizer = new ResizeObserver(([entry]) => {
		cssWidth = entry.contentRect.width;
		cssHeight = entry.contentRect.height;
	});
	resizer.observe(canvas);
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
	canvas.addEventListener(
		'webglcontextlost',
		event => {
			event.preventDefault();
			lost = true;
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
	async function initialize() {
		const current = ++generation;
		loaded = false;
		try {
			const compiled = await makeProgram(vertex, fragment, [
				'photo',
				'colourPhoto',
				'colourMix',
				'entrance',
				'depthMask',
				'resolution',
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
			main = compiled;
			quad = makeBuffer(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
			photoTexture = texture(0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo));
			colourTexture = texture(2, () =>
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, colourImage || photo)
			);
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
			loaded = true;
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
	Promise.all([
		photoReady.then(() => photo.decode()),
		load(depthUrl),
		load('/images/hero-depth/portrait-colour.webp').catch(() => null),
	])
		.then(([, depth, colour]) => {
			if (disposed) return;
			colourImage = colour;
			bakedDepth = bakeDepth(depth);
			void initialize();
		})
		.catch(() => {
			if (!disposed) onReady(false);
		});
	gsap.ticker.add(draw);
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
