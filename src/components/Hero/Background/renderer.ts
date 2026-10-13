// Imports
// ------------
import { gsap } from 'gsap';
import { type DepthSettings, depthUrl, scrollKeys } from './effect-settings';
import { fragment, vertex } from './shaders';

type Uniforms = Record<string, WebGLUniformLocation | null>;
interface RendererOptions {
	canvas: HTMLCanvasElement;
	photo: HTMLImageElement;
	host: HTMLElement;
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
export function mountDepthEffect({ canvas, photo, host, getSettings, onReady }: RendererOptions): DepthController {
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
		cursorSpeed = 0,
		impulse = 0,
		rate = 0,
		speed = 0,
		idle = Infinity,
		held = 0;
	let bakedDepth: ReturnType<typeof bakeDepth>;
	let main: ReturnType<typeof makeProgram>;
	const scrollValues = new Float32Array(scrollKeys.length);

	function resetMotion() {
		impulse = rate = speed = held = 0;
		idle = Infinity;
		target = [0, 0];
		dirty = true;
	}
	function kick(delta: number) {
		if (!Number.isFinite(delta) || delta <= 0 || !visible || document.hidden) return;
		if (idle > 0.4) held = 0;
		idle = 0;
		impulse += delta;
		dirty = true;
	}
	function makeProgram(v: string, f: string, names: string[]) {
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
			if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
				const message = gl.getShaderInfoLog(shader);
				gl.deleteShader(shader);
				throw new Error(message || 'Depth shader compilation failed');
			}
			gl.attachShader(program, shader);
			gl.deleteShader(shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(gl.getProgramInfoLog(program) || 'Depth program link failed');
		const uniforms: Uniforms = {};
		for (const name of names) uniforms[name] = gl.getUniformLocation(program, name);
		return { program, uniforms };
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
				dirty = true;
			}
			if (s !== lastSettings) {
				lastSettings = s;
				dirty = true;
			}
			const dest = s.auto ? [Math.sin(now * 0.00055) * 0.8, Math.cos(now * 0.00043) * 0.55] : target;
			const ease = 1 - s.smooth ** (dt * 60);
			pointer = pointer.map((v, i) => v + (dest[i] - v) * ease);
			cursorSpeed = Math.max(
				Math.min(1, (Math.hypot(cursor[0] - previousCursor[0], cursor[1] - previousCursor[1]) / dt) * 0.5),
				cursorSpeed * Math.exp(-dt * 7)
			);
			previousCursor = [...cursor];
			const input = Math.max(0, impulse);
			impulse = 0;
			rate += (input / dt - rate) * (1 - Math.exp(-dt / 0.1));
			const measured = rate / (3200 + Math.abs(rate));
			idle = input > 0 ? 0 : idle + dt;
			if (idle <= 0.4) held = Math.max(held, measured);
			else held = 0;
			const goal = idle <= 0.4 ? held : measured;
			speed = Math.max(0, speed + (goal - speed) * (1 - Math.exp(-dt / (goal > speed ? 0.1 : 0.24))));
			if (rate < 0.01 && speed < 0.00001) rate = speed = 0;
			const settled =
				!s.auto &&
				rate === 0 &&
				speed === 0 &&
				cursorSpeed < CURSOR_SPEED_EPSILON &&
				Math.abs(pointer[0] - dest[0]) < SETTLE_EPSILON &&
				Math.abs(pointer[1] - dest[1]) < SETTLE_EPSILON;
			// Idle frames are identical, so skip them; one last draw lands the snapped rest pose
			if (settled && !dirty) return;
			dirty = !settled;
			if (settled) {
				pointer = [...dest];
				cursorSpeed = 0;
			}
			scrollKeys.forEach((key, i) => {
				scrollValues[i] = !s.depth && s[`${key}On`] ? s[key] : 0;
			});
			const u = main.uniforms;
			commonUniforms(u, s);
			gl.uniform2f(u.cursorPos, cursor[0], cursor[1]);
			gl.uniform1f(u.cursorOn, cursorActive);
			gl.uniform1f(u.cursorSpeed, cursorSpeed);
			gl.uniform1f(u.chromaFX, s.chromaOn ? s.chroma : 0);
			gl.uniform1f(u.glowFX, s.glowOn ? s.glow : 0);
			gl.uniform1f(u.debug, s.depth ? 1 : 0);
			gl.uniform1fv(u['scrollFX[0]'], scrollValues);
			gl.uniform1f(u.scrollVelocity, speed);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
		} catch (error) {
			loaded = false;
			onReady(false);
			console.error('Hero depth effect:', error);
		}
	}
	function ignored(event: Event) {
		return (
			event.target instanceof Element &&
			!!event.target.closest('a, button, input, textarea, select, [data-hero-settings]')
		);
	}
	function track(event: PointerEvent) {
		const r = canvas.getBoundingClientRect();
		cursor = [(event.clientX - r.left) / r.width, (event.clientY - r.top) / r.height];
		cursorActive = 1;
		target = cursor.map(v => Math.max(-1, Math.min(1, v * 2 - 1)));
		dirty = true;
	}
	host.addEventListener('pointermove', track, { signal: events.signal });
	host.addEventListener(
		'pointerleave',
		() => {
			target = [0, 0];
			cursorActive = 0;
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
	canvas.addEventListener(
		'webglcontextlost',
		event => {
			event.preventDefault();
			lost = true;
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
			initialize();
		},
		{ signal: events.signal }
	);
	function initialize() {
		try {
			main = makeProgram(vertex, fragment, [
				'photo',
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
			makeBuffer(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
			texture(0, () => gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo));
			texture(1, () => {
				const { depth, width, height } = bakedDepth;
				gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, width, height, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, depth);
			});
			// The only program and buffer on this context, so bind them once
			bindProgram(main.program);
			const position = gl.getAttribLocation(main.program, 'position');
			gl.enableVertexAttribArray(position);
			gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
			gl.uniform1i(main.uniforms.photo, 0);
			gl.uniform1i(main.uniforms.depthMask, 1);
			loaded = true;
			dirty = true;
			draw(0, 16);
			if (loaded) onReady(true);
		} catch (error) {
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
	Promise.all([photoReady.then(() => photo.decode()), load(depthUrl)])
		.then(([, depth]) => {
			if (disposed) return;
			bakedDepth = bakeDepth(depth);
			initialize();
		})
		.catch(() => {
			if (!disposed) onReady(false);
		});
	gsap.ticker.add(draw);
	return {
		preview() {
			resetMotion();
			kick(500);
		},
		destroy() {
			disposed = true;
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
