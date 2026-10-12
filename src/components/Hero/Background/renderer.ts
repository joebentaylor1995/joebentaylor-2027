// Imports
// ------------
import { gsap } from 'gsap';
import { type DepthSettings, depthUrl, portraitUrl, scrollKeys } from './effect-settings';
import { fragment, vertex } from './shaders';

type Uniforms = Record<string, WebGLUniformLocation | null>;
interface RendererOptions {
	canvas: HTMLCanvasElement;
	host: HTMLElement;
	getSettings: () => DepthSettings;
	onReady: (ready: boolean) => void;
}
export interface DepthController {
	destroy: () => void;
	preview: () => void;
}

// Renderer lifecycle
// ------------
export function mountDepthEffect({ canvas, host, getSettings, onReady }: RendererOptions): DepthController {
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
		lost = false;
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
	let image: HTMLImageElement, depthImage: HTMLImageElement;
	let main: ReturnType<typeof makeProgram>, quad: WebGLBuffer;
	const scrollValues = new Float32Array(5);

	function resetMotion() {
		impulse = rate = speed = held = 0;
		idle = Infinity;
		target = [0, 0];
	}
	function kick(delta: number) {
		if (!Number.isFinite(delta) || delta <= 0 || !visible || document.hidden) return;
		if (idle > 0.4) held = 0;
		idle = 0;
		impulse += delta;
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
	function texture(source: HTMLImageElement, unit: number) {
		const t = gl.createTexture();
		if (!t) throw new Error('Unable to allocate depth texture');
		textures.push(t);
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, t);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
	}
	function commonUniforms(u: Uniforms, s: DepthSettings) {
		gl.uniform2f(u.resolution, canvas.width, canvas.height);
		gl.uniform2f(u.motion, pointer[0] * s.horizontal, pointer[1] * s.vertical);
		gl.uniform2f(u.positionShift, s.positionX / 100, s.positionY / 100);
		for (const key of ['intensity', 'lift', 'zoom'] as const) gl.uniform1f(u[key], s[key]);
		gl.uniform1f(u.rotation, (s.rotation * Math.PI) / 180);
	}
	function attribute(program: WebGLProgram, name: string, size: number, stride = 0, offset = 0) {
		const location = gl.getAttribLocation(program, name);
		gl.enableVertexAttribArray(location);
		gl.vertexAttribPointer(location, size, gl.FLOAT, false, stride, offset);
		return location;
	}
	function draw(_time: number, deltaMs: number) {
		if (!loaded || disposed || lost || !visible || document.hidden) return;
		try {
			const now = performance.now(),
				dt = Math.min(deltaMs / 1000, 0.05) || 0.016,
				s = getSettings();
			const r = canvas.getBoundingClientRect(),
				dpr = Math.min(devicePixelRatio, 2);
			const w = Math.max(1, Math.round(r.width * dpr)),
				h = Math.max(1, Math.round(r.height * dpr));
			if (canvas.width !== w || canvas.height !== h) {
				canvas.width = w;
				canvas.height = h;
				gl.viewport(0, 0, w, h);
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
			scrollKeys.forEach((key, i) => {
				scrollValues[i] = !s.depth && s[`${key}On`] ? s[key] : 0;
			});
			bindProgram(main.program);
			gl.bindBuffer(gl.ARRAY_BUFFER, quad);
			const position = attribute(main.program, 'position', 2);
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
			gl.disableVertexAttribArray(position);
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
	}
	host.addEventListener('pointermove', track, { signal: events.signal });
	host.addEventListener(
		'pointerleave',
		() => {
			target = [0, 0];
			cursorActive = 0;
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
			quad = makeBuffer(new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]));
			texture(image, 0);
			texture(depthImage, 1);
			bindProgram(main.program);
			gl.uniform1i(main.uniforms.photo, 0);
			gl.uniform1i(main.uniforms.depthMask, 1);
			loaded = true;
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
	Promise.all([load(portraitUrl), load(depthUrl)])
		.then(([photo, depth]) => {
			if (disposed) return;
			image = photo;
			depthImage = depth;
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
			for (const b of buffers) gl.deleteBuffer(b);
			for (const t of textures) gl.deleteTexture(t);
			for (const p of programs) gl.deleteProgram(p);
		},
	};
}
