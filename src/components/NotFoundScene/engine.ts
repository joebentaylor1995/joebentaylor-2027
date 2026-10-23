// Imports
// ------------
import { baseColors } from '@theme/colors';
import { gsap } from 'gsap';
import { fragment, vertex } from './shaders';

// Renderer
// ------------
export function mountNotFoundRain(canvas: HTMLCanvasElement, onReady: (ready: boolean) => void) {
	const context = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
	if (!context) return { destroy() {}, pause(_value: boolean) {} };
	const gl = context;
	const bindProgram = gl.useProgram.bind(gl);
	const events = new AbortController();
	const motion = matchMedia('(prefers-reduced-motion: reduce)');
	const shaders: WebGLShader[] = [],
		programs: WebGLProgram[] = [],
		textures: WebGLTexture[] = [],
		buffers: WebGLBuffer[] = [];
	let disposed = false,
		paused = false,
		dirty = true,
		width = 1,
		height = 1,
		count = 0,
		elapsed = 0;
	let seed = 17;
	const random = () => {
		seed = (seed * 16807) % 2147483647;
		return (seed - 1) / 2147483646;
	};
	const rgb = (hex: string) => [1, 3, 5].map(offset => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
	const compile = (type: number, source: string) => {
		const shader = gl.createShader(type);
		if (!shader) throw new Error('Shader unavailable');
		shaders.push(shader);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS))
			throw new Error(gl.getShaderInfoLog(shader) || 'Shader failed');
		return shader;
	};
	const program = (vs: string, fs: string) => {
		const result = gl.createProgram();
		if (!result) throw new Error('Program unavailable');
		programs.push(result);
		gl.attachShader(result, compile(gl.VERTEX_SHADER, vs));
		gl.attachShader(result, compile(gl.FRAGMENT_SHADER, fs));
		gl.linkProgram(result);
		if (!gl.getProgramParameter(result, gl.LINK_STATUS))
			throw new Error(gl.getProgramInfoLog(result) || 'Link failed');
		return result;
	};
	const buffer = () => {
		const result = gl.createBuffer();
		if (!result) throw new Error('Buffer unavailable');
		buffers.push(result);
		return result;
	};
	const upload = (unit: number, source: HTMLCanvasElement) => {
		const texture = gl.createTexture();
		if (!texture) throw new Error('Texture unavailable');
		textures.push(texture);
		gl.activeTexture(gl.TEXTURE0 + unit);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	};
	const free = () => {
		for (const resource of textures) gl.deleteTexture(resource);
		for (const resource of buffers) gl.deleteBuffer(resource);
		for (const resource of programs) gl.deleteProgram(resource);
		for (const resource of shaders) gl.deleteShader(resource);
	};
	try {
		const rain = program(vertex, fragment);
		const background = program(
			'attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}',
			'precision mediump float;varying vec2 uv;uniform vec3 top;uniform vec3 bottom;void main(){gl_FragColor=vec4(mix(top,bottom,1.-uv.y),1.);}'
		);
		bindProgram(background);
		gl.uniform3fv(gl.getUniformLocation(background, 'top'), rgb(baseColors.brand.c4));
		gl.uniform3fv(gl.getUniformLocation(background, 'bottom'), rgb(baseColors.brand.c1));
		const backdrop = buffer();
		gl.bindBuffer(gl.ARRAY_BUFFER, backdrop);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
		const position = gl.getAttribLocation(background, 'position');
		bindProgram(rain);
		const uniforms: Record<string, WebGLUniformLocation | null> = {};
		for (const name of [
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
			'blue',
		])
			uniforms[name] = gl.getUniformLocation(rain, `u_${name}`);
		const value = (name: string, amount: number) => gl.uniform1f(uniforms[name], amount);
		// One generated height map drives every glyph's light, normal and displacement.
		const map = Object.assign(document.createElement('canvas'), { width: 1536, height: 640 });
		const c = map.getContext('2d');
		if (!c) throw new Error('Canvas unavailable');
		c.fillStyle = '#000';
		c.fillRect(0, 0, 1536, 640);
		c.font = '900 660px Arial, sans-serif';
		c.textAlign = 'center';
		const metrics = c.measureText('404');
		c.translate(768, 0);
		c.scale(1360 / metrics.width, 1);
		const baseline = (640 + metrics.actualBoundingBoxAscent - metrics.actualBoundingBoxDescent) / 2;
		c.shadowColor = '#aaa';
		c.shadowBlur = 12;
		c.fillStyle = '#eee';
		c.fillText('404', 0, baseline);
		c.shadowBlur = 0;
		c.fillStyle = '#fff';
		c.fillText('404', 0, baseline);
		upload(1, map);
		const atlas = Object.assign(document.createElement('canvas'), { width: 512, height: 512 });
		const a = atlas.getContext('2d');
		if (!a) throw new Error('Atlas unavailable');
		a.fillStyle = '#fff';
		a.font = '42px "Hiragino Kaku Gothic ProN", "Yu Gothic", monospace';
		a.textAlign = 'center';
		a.textBaseline = 'middle';
		const glyphs = Array.from(
			'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン0123456789<>+=*:⟐∆'
		);
		for (let i = 0; i < 64; i++)
			a.fillText(glyphs[i % glyphs.length], (i % 8) * 64 + 32, Math.floor(i / 8) * 64 + 33);
		upload(0, atlas);
		gl.uniform1i(uniforms.atlas, 0);
		gl.uniform1i(uniforms.portrait, 1);
		gl.uniform3fv(uniforms.blue, rgb(baseColors.brand.c1));
		for (const [name, amount] of Object.entries({
			size: 8 / 23,
			brightness: 0.95,
			glow: 0.65,
			fade: 0.5,
			face: 2.3,
			portraitSize: 0.95,
			aspect: 2.4,
			depth: 0.65,
			bend: 0.3,
			angle: 0,
			reach: 120,
			ripple: 0.3,
		}))
			value(name, amount);
		const particles = buffer(),
			drop = gl.getAttribLocation(rain, 'a_drop'),
			style = gl.getAttribLocation(rain, 'a_style');
		const resize = () => {
			width = Math.max(1, canvas.clientWidth);
			height = Math.max(1, canvas.clientHeight);
			const ratio = Math.min(devicePixelRatio || 1, width <= 600 ? 1.5 : 2);
			canvas.width = Math.round(width * ratio);
			canvas.height = Math.round(height * ratio);
			gl.viewport(0, 0, canvas.width, canvas.height);
			bindProgram(rain);
			gl.uniform2f(uniforms.resolution, width, height);
			value('dpr', ratio);
			seed = 17;
			const data: number[] = [],
				scale = 8 / 23,
				row = 24 * scale;
			for (let layer = 0; layer < 3; layer++) {
				const spacing = ((layer === 0 ? 32 : 25) * scale) / 1.5;
				for (let x = 8; x < width + spacing; x += spacing) {
					const offset = random() * (height + 160),
						velocity = 35 + random() * 65 + layer * 24,
						length = 8 + Math.floor(random() * 20),
						gap = 8 + Math.floor(random() * 14);
					for (let j = 0; j < Math.ceil((height + 160) / row); j++) {
						const phase = j % (length + gap);
						if (phase >= length) continue;
						data.push(
							x + (layer - 1) * 7,
							(offset + j * row) % (height + 160),
							velocity,
							Math.floor(random() * 64),
							layer === 0 ? 15 : layer === 1 ? 19 : 23,
							(0.13 + 0.85 * (phase / length) ** 1.6) * (layer === 0 ? 0.28 : layer === 1 ? 0.56 : 1)
						);
					}
				}
			}
			count = data.length / 6;
			gl.bindBuffer(gl.ARRAY_BUFFER, particles);
			gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
			dirty = true;
		};
		const cursor = { x: 0, y: 0, tx: 0, ty: 0, active: 0, target: 0 };
		const waves = Array.from({ length: 4 }, () => ({ x: 0, y: 0, age: 10, amplitude: 0 }));
		const waveData = new Float32Array(16);
		let waveIndex = 0;
		const charge = { holding: false, started: 0, amount: 0, age: 8, dead: false, x: 0, y: 0, pointer: -1 };
		const point = (event: PointerEvent) => {
			const rect = canvas.getBoundingClientRect();
			cursor.tx = event.clientX - rect.left;
			cursor.ty = event.clientY - rect.top;
			cursor.target = 1;
		};
		const finish = (cancel = false) => {
			if (!charge.holding) return;
			charge.holding = false;
			const seconds = (performance.now() - charge.started) / 1000;
			if (!cancel && !paused && !motion.matches) {
				if (seconds >= 0.7) {
					charge.dead = true;
					charge.age = 0;
					charge.x = cursor.x;
					charge.y = cursor.y;
					cursor.target = 0;
					for (const wave of waves) wave.amplitude = 0;
				} else {
					waves[waveIndex] = { x: cursor.x, y: cursor.y, age: 0, amplitude: 1.3 + seconds };
					waveIndex = (waveIndex + 1) % 4;
				}
			}
		};
		canvas.addEventListener('pointermove', point, { signal: events.signal });
		canvas.addEventListener(
			'pointerdown',
			event => {
				if (event.button !== 0 || paused || motion.matches || charge.dead) return;
				point(event);
				cursor.x = cursor.tx;
				cursor.y = cursor.ty;
				charge.holding = true;
				charge.started = performance.now();
				charge.pointer = event.pointerId;
				canvas.setPointerCapture(event.pointerId);
			},
			{ signal: events.signal }
		);
		canvas.addEventListener(
			'pointerup',
			event => {
				if (event.pointerId !== charge.pointer) return;
				finish();
				if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
				if (event.pointerType === 'touch') cursor.target = 0;
			},
			{ signal: events.signal }
		);
		canvas.addEventListener(
			'pointerleave',
			() => {
				if (!charge.holding) cursor.target = 0;
			},
			{ signal: events.signal }
		);
		canvas.addEventListener(
			'pointercancel',
			() => {
				finish(true);
				cursor.target = 0;
			},
			{ signal: events.signal }
		);
		canvas.addEventListener('lostpointercapture', () => finish(true), { signal: events.signal });
		window.addEventListener(
			'blur',
			() => {
				finish(true);
				cursor.target = 0;
			},
			{ signal: events.signal }
		);
		document.addEventListener(
			'visibilitychange',
			() => {
				finish(true);
				dirty = true;
			},
			{ signal: events.signal }
		);
		motion.addEventListener(
			'change',
			() => {
				finish(true);
				charge.amount = 0;
				dirty = true;
			},
			{ signal: events.signal }
		);
		canvas.addEventListener(
			'webglcontextlost',
			event => {
				event.preventDefault();
				disposed = true;
				onReady(false);
			},
			{ signal: events.signal }
		);
		const observer = new ResizeObserver(resize);
		observer.observe(canvas);
		resize();
		cursor.x = cursor.tx = width / 2;
		cursor.y = cursor.ty = height / 2;
		const tick = (_time: number, delta: number) => {
			if (
				disposed ||
				document.hidden ||
				document.documentElement.matches('[data-navigation-pending], [data-navigation-wave]') ||
				((paused || motion.matches) && !dirty)
			)
				return;
			dirty = false;
			const dt = paused || motion.matches ? 0 : Math.min(delta / 1000, 0.05);
			if (!charge.dead || charge.age >= 4.5) elapsed += dt * 1.3;
			const ease = 1 - Math.exp(-dt * 9);
			cursor.x += (cursor.tx - cursor.x) * ease;
			cursor.y += (cursor.ty - cursor.y) * ease;
			cursor.active += (cursor.target - cursor.active) * ease;
			charge.age = Math.min(8, charge.age + dt);
			if (charge.age >= 7.6) charge.dead = false;
			const seconds = charge.holding ? (performance.now() - charge.started) / 1000 : 0;
			charge.amount +=
				((charge.holding ? Math.min(1, seconds / 0.7) : 0) - charge.amount) *
				(1 - Math.exp(-dt * (charge.holding ? 18 : 5)));
			const q = charge.amount,
				enabled = motion.matches || charge.dead ? 0 : 1;
			gl.disable(gl.BLEND);
			bindProgram(background);
			gl.bindBuffer(gl.ARRAY_BUFFER, backdrop);
			gl.enableVertexAttribArray(position);
			gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
			gl.drawArrays(gl.TRIANGLES, 0, 3);
			gl.disableVertexAttribArray(position);
			bindProgram(rain);
			gl.bindBuffer(gl.ARRAY_BUFFER, particles);
			gl.enableVertexAttribArray(drop);
			gl.enableVertexAttribArray(style);
			gl.vertexAttribPointer(drop, 4, gl.FLOAT, false, 24, 0);
			gl.vertexAttribPointer(style, 2, gl.FLOAT, false, 24, 16);
			gl.enable(gl.BLEND);
			gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);
			value('time', elapsed);
			value('depth', 0.65 + q * 0.18);
			value('bend', 0.3 * (1 - q));
			value('glow', 0.65 + q * 0.55);
			value('portraitSize', 0.95 * (1 + q * 0.07));
			value('chargeDetail', q * 0.25);
			value('magnet', (0.65 * cursor.active + q * 1.8) * enabled);
			value('ripple', 0.3 * enabled);
			gl.uniform2f(uniforms.cursor, cursor.x, cursor.y);
			gl.uniform2f(
				uniforms.tilt,
				(cursor.x / width - 0.5) * 0.65 * cursor.active * enabled,
				(cursor.y / height - 0.5) * 0.35 * cursor.active * enabled
			);
			gl.uniform2f(uniforms.chargeWave, seconds, charge.holding ? 0.2 + q * 0.55 : 0);
			gl.uniform4f(uniforms.burst, charge.x, charge.y, charge.age, charge.dead ? 1 : 0);
			for (let i = 0; i < 4; i++) {
				const wave = waves[i];
				wave.age = Math.min(10, wave.age + dt);
				waveData.set([wave.x, wave.y, wave.age, wave.amplitude], i * 4);
			}
			gl.uniform4fv(uniforms['waves[0]'], waveData);
			value('pass', 1);
			gl.drawArrays(gl.POINTS, 0, count);
			value('pass', 0);
			gl.drawArrays(gl.POINTS, 0, count);
			gl.disableVertexAttribArray(drop);
			gl.disableVertexAttribArray(style);
		};
		gsap.ticker.add(tick);
		tick(0, 0);
		onReady(true);
		return {
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
				free();
			},
		};
	} catch (error) {
		events.abort();
		free();
		throw error;
	}
}
