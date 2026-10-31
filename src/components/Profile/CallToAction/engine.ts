// Imports
// ------------
import { getSettings, getSettingsTarget, subscribe } from '@parts/ProfileReveal/Settings/store';
import { canHover } from '@utils/desktopHover';
import gsap from 'gsap';
import type { MatrixScene } from './interface';
import { fragmentShader, vertexShader } from './shaders';

// Constants
// ------------
// Press-and-hold time (seconds) at which a tap becomes a full charge that bursts the portrait
const CHARGE_SECONDS = 0.7;

// Burst timeline in seconds since the click: when the glyphs start re-forming, and when the cycle is over
const RETURN_START = 4.5;
const CYCLE_END = 7.6;

// Helpers
// ------------
// Unwraps a GL resource, throwing if the browser could not allocate it
function required<T>(value: T | null): T {
	if (!value) throw new Error('Matrix resource unavailable');
	return value;
}

// Engine
// ------------
// Draws the Connect section's digital-rain portrait. Each glyph is a GL point; the vertex shader lifts
// them over a greyscale height map of the face (built in a worker from /images/connect/face.png).
// Hover pulls glyphs towards the cursor, a tap sends a ripple, and a long press charges then bursts
// the portrait, which re-forms after CYCLE_END seconds. section.dataset.state/matrixPhase mirror the lifecycle.
export function createMatrix(canvas: HTMLCanvasElement, section: HTMLElement): MatrixScene {
	// Programs
	const gl = required(canvas.getContext('webgl', { alpha: true, antialias: false, powerPreference: 'low-power' }));
	const shaders: WebGLShader[] = [];
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
	// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
	gl.useProgram(program);

	// Uniform locations (named u_<name> in the shaders)
	const names = [
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
	const uniforms = Object.fromEntries(names.map(name => [name, gl.getUniformLocation(program, `u_${name}`)]));
	const scalar = (name: string, value: number) => gl.uniform1f(uniforms[name], value);

	// Backdrop: a vertical gradient drawn first, from near-black at the top to blue at the bottom
	const backgroundProgram = required(gl.createProgram());
	for (const [kind, source] of [
		[
			gl.VERTEX_SHADER,
			'attribute vec2 position; varying vec2 uv; void main(){uv=position*0.5+0.5;gl_Position=vec4(position,0.0,1.0);}',
		],
		[
			gl.FRAGMENT_SHADER,
			'precision mediump float; varying vec2 uv; void main(){gl_FragColor=vec4(mix(vec3(18.0)/255.0,vec3(22.0,83.0,255.0)/255.0,1.0-uv.y),1.0);}',
		],
	] as const) {
		const shader = required(gl.createShader(kind));
		shaders.push(shader);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		gl.attachShader(backgroundProgram, shader);
	}

	gl.linkProgram(backgroundProgram);
	const backgroundPosition = gl.getAttribLocation(backgroundProgram, 'position');
	const backgroundBuffer = required(gl.createBuffer());
	gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);

	// Particle buffer, 24-byte stride: a_drop (x, y, speed, glyph index) then a_style (size, brightness)
	const buffer = required(gl.createBuffer());
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	const attributes = [
		[gl.getAttribLocation(program, 'a_drop'), 4, 0],
		[gl.getAttribLocation(program, 'a_style'), 2, 16],
	] as const;
	for (const [attribute, size, offset] of attributes) {
		gl.enableVertexAttribArray(attribute);
		gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 24, offset);
	}

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
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.uniform1i(uniforms[name], unit);
		return item;
	}

	// Glyph atlas: the letters of the name, repeated to fill an 8x8 grid of 64px cells
	const atlas = document.createElement('canvas');
	atlas.width = atlas.height = 512;
	const ink = required(atlas.getContext('2d'));
	ink.fillStyle = 'white';
	ink.font = '42px monospace';
	ink.textAlign = 'center';
	ink.textBaseline = 'middle';
	const letters = Array.from('JOE BEN TAYLOR').filter(letter => letter !== ' ');
	for (let i = 0; i < 64; i++)
		ink.fillText(letters[i % letters.length], (i % 8) * 64 + 32, Math.floor(i / 8) * 64 + 33);
	texture(0, 'atlas', atlas);

	// Placeholder until the worker has produced the face height map
	const portrait = texture(1, 'portrait');

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

	// Press-and-hold + burst state (burstAge is seconds since the burst; it rests at CYCLE_END)
	let holding = false,
		holdStarted = 0,
		holdTime = 0,
		charge = 0,
		dead = false,
		burstAge = CYCLE_END,
		burstX = 0,
		burstY = 0;
	let pointerId: number | null = null;

	// Cursor eases towards its target; active fades the hover effect in and out
	const cursor = { x: 0, y: 0, tx: 0, ty: 0, active: 0, target: 0 };

	// Ring buffer of the four latest tap ripples, packed into waveUniforms as (x, y, age, amplitude)
	const waves = Array.from({ length: 4 }, () => ({ x: 0, y: 0, age: 10, amplitude: 0 }));
	const waveUniforms = new Float32Array(16);
	let waveIndex = 0;

	// Seeded generator (Lehmer) so the rain layout is the same after every resize
	let seed = 17;
	const random = () => {
		seed = (seed * 16807) % 2147483647;
		return (seed - 1) / 2147483646;
	};

	// Resizes the canvas (pixel ratio capped at 1.5) and rebuilds the rain: three depth layers of
	// columns, each a dashed stream of glyphs that brightens towards its head
	function resize() {
		const rect = canvas.getBoundingClientRect();
		width = Math.max(1, rect.width);
		height = Math.max(1, rect.height);
		const dpr = Math.min(devicePixelRatio || 1, 1.5);
		canvas.width = Math.round(width * dpr);
		canvas.height = Math.round(height * dpr);
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.uniform2f(uniforms.resolution, width, height);
		scalar('dpr', dpr);

		seed = 17;
		const data: number[] = [];
		const scale = 9 / 23,
			rowSpacing = 24 * scale;

		for (let layer = 0; layer < 3; layer++) {
			const spacing = ((layer === 0 ? 32 : 25) * scale) / 1.4;
			for (let x = 8; x < width + spacing; x += spacing) {
				// Per column: start offset, fall speed, streak length and gap between streaks
				const offset = random() * (height + 160),
					velocity = 35 + random() * 65 + layer * 24;
				const length = 8 + Math.floor(random() * 20),
					gap = 8 + Math.floor(random() * 14);
				for (let j = 0; j < Math.ceil((height + 160) / rowSpacing); j++) {
					const phase = j % (length + gap);
					// Gap cells emit nothing
					if (phase >= length) continue;
					const brightness =
						(0.13 + 0.85 * (phase / length) ** 1.6) * (layer === 0 ? 0.28 : layer === 1 ? 0.56 : 1);
					data.push(
						x + (layer - 1) * 7,
						(offset + j * rowSpacing) % (height + 160),
						velocity,
						Math.floor(random() * 64),
						layer === 0 ? 15 : layer === 1 ? 19 : 23,
						brightness
					);
				}
			}
		}

		count = data.length / 6;
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
		draw(0);
	}

	// Pointer handling. cancel() abandons any press without triggering a ripple or burst
	function cancel() {
		holding = false;
		pointerId = null;
		cursor.target = 0;
	}
	function move(event: PointerEvent) {
		const rect = canvas.getBoundingClientRect();
		cursor.tx = event.clientX - rect.left;
		cursor.ty = event.clientY - rect.top;
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
	// Releasing after CHARGE_SECONDS bursts the portrait; a shorter press drops a ripple stronger the longer it was held
	function release(event: PointerEvent) {
		if (!holding || event.pointerId !== pointerId) return;
		holdTime = (performance.now() - holdStarted) / 1000;
		if (holdTime >= CHARGE_SECONDS) {
			dead = true;
			burstAge = 0;
			burstX = cursor.x;
			burstY = cursor.y;
			for (const wave of waves) wave.amplitude = 0;
		} else {
			waves[waveIndex] = { x: cursor.x, y: cursor.y, age: 0, amplitude: 1.3 + holdTime };
			waveIndex = (waveIndex + 1) % waves.length;
		}
		cancel();
		if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
	}

	// One frame. dt drives motion (capped by the ticker); timelineDelta advances the burst timeline.
	// With reduced motion everything is frozen and any press is cancelled.
	function draw(dt: number, timelineDelta = dt) {
		if (disposed) return;
		if (!reduced.matches) {
			if (!dead || burstAge >= RETURN_START) elapsed += dt * getSettings().matrixSpeed;
			if (holding) holdTime = (performance.now() - holdStarted) / 1000;
			burstAge = Math.min(CYCLE_END, burstAge + timelineDelta);
			if (dead && burstAge >= CYCLE_END) {
				dead = false;
				cursor.active = cursor.target = 0;
			}
			charge +=
				((holding ? Math.min(1, holdTime / CHARGE_SECONDS) : 0) - charge) *
				(1 - Math.exp(-dt * (holding ? 18 : 5)));
		} else {
			cancel();
			charge = 0;
			dead = false;
		}

		// Frame-rate independent easing of the cursor and its influence
		const ease = 1 - Math.exp(-dt * 9);
		if (!holding && !canHover()) cursor.target = 0;
		cursor.x += (cursor.tx - cursor.x) * ease;
		cursor.y += (cursor.ty - cursor.y) * ease;
		cursor.active += (cursor.target - cursor.active) * ease;
		for (const wave of waves) wave.age = Math.min(10, wave.age + dt);

		// Backdrop pass
		gl.disable(gl.BLEND);
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(backgroundProgram);
		for (const [attribute] of attributes) gl.disableVertexAttribArray(attribute);
		gl.bindBuffer(gl.ARRAY_BUFFER, backgroundBuffer);
		gl.enableVertexAttribArray(backgroundPosition);
		gl.vertexAttribPointer(backgroundPosition, 2, gl.FLOAT, false, 0, 0);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
		gl.disableVertexAttribArray(backgroundPosition);

		// Rain pass, additive blending
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL API, not a React hook.
		gl.useProgram(program);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		for (const [attribute, size, offset] of attributes) {
			gl.enableVertexAttribArray(attribute);
			gl.vertexAttribPointer(attribute, size, gl.FLOAT, false, 24, offset);
		}

		gl.enable(gl.BLEND);
		gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE, gl.ZERO, gl.ONE);

		// Look settings come from the live settings panel; charge (0..1) deepens and brightens the portrait
		for (const [name, value] of Object.entries({
			time: elapsed,
			size: 9 / 23,
			brightness: getSettings().matrixBrightness,
			glow: getSettings().matrixGlow + charge * 0.55,
			fade: 0.5,
			face: getSettings().matrixFace,
			portraitSize:
				(getSettingsTarget() === 'mobile'
					? getSettings().mobileFaceSmall
						? getSettings().mobileFaceSize
						: 1.45
					: getSettings().matrixPortraitSize) *
				(1 + charge * 0.07),
			depth: getSettings().matrixDepth + charge * 0.18,
			bend: getSettings().matrixBend * (1 - charge),
			angle: 0,
			reach: 120,
			ripple: reduced.matches || dead ? 0 : 0.3,
			chargeDetail: charge * 0.25,
			magnet: reduced.matches || dead ? 0 : cursor.active * 0.9 + charge * 1.8,
		}))
			scalar(name, value);

		gl.uniform2f(uniforms.cursor, cursor.x, cursor.y);
		gl.uniform2f(uniforms.tilt, 0, 0);
		gl.uniform2f(uniforms.chargeWave, holding ? holdTime : 0, holding ? 0.2 + charge * 0.55 : 0);
		gl.uniform4f(uniforms.burst, burstX, burstY, burstAge, dead ? 1 : 0);
		for (let i = 0; i < waves.length; i++) {
			const wave = waves[i];
			waveUniforms[i * 4] = wave.x;
			waveUniforms[i * 4 + 1] = wave.y;
			waveUniforms[i * 4 + 2] = wave.age;
			waveUniforms[i * 4 + 3] = wave.amplitude;
		}
		gl.uniform4fv(uniforms['waves[0]'], waveUniforms);

		// Draw twice: a large soft glow pass (pass 1), then the crisp glyphs (pass 0)
		scalar('pass', 1);
		gl.drawArrays(gl.POINTS, 0, count);
		scalar('pass', 0);
		gl.drawArrays(gl.POINTS, 0, count);

		// Screen shake on the burst, decaying quickly; exposed to CSS as --matrix-x/--matrix-y
		const shake = dead && !reduced.matches ? 8 * Math.exp(-burstAge * 2) * Math.min(1, burstAge * 25) : 0;
		canvas.style.setProperty('--matrix-x', `${Math.sin(burstAge * 61) * shake}px`);
		canvas.style.setProperty('--matrix-y', `${Math.sin(burstAge * 83 + 1) * shake * 0.65}px`);

		// Phase exposed for styling and tests
		section.dataset.matrixPhase = holding
			? 'charging'
			: dead
				? burstAge < RETURN_START
					? 'disintegrating'
					: 'reforming'
				: 'rain';
	}

	// Ticker callback; syncTicker() adds it only while visible, ready, and motion is allowed
	const tick = (_time: number, delta: number) => {
		if (visible && ready && !document.hidden && !reduced.matches) draw(Math.min(delta / 1000, 0.05), delta / 1000);
	};
	function syncTicker() {
		gsap.ticker.remove(tick);
		if (visible && ready && !document.hidden && !reduced.matches) gsap.ticker.add(tick);
		else cancel();
		if (ready && visible && !document.hidden) draw(0);
	}

	// Face height map: load the PNG, shrink to 512px wide, let the worker cut out the backdrop and
	// convert to luminance, then upload it as texture 1 and start rendering
	let portraitWorker: Worker | undefined;
	const img = new Image();
	img.onload = () => {
		if (disposed) return;
		const map = document.createElement('canvas');
		map.width = 512;
		map.height = Math.round((512 * img.height) / img.width);
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
		};
		worker.onerror = () => {
			worker.terminate();
			portraitWorker = undefined;
			if (!disposed) section.dataset.state = 'fallback';
		};
		worker.postMessage(pixels, [pixels.data.buffer]);
	};
	img.onerror = () => {
		if (!disposed) section.dataset.state = 'fallback';
	};
	img.src = '/images/connect/face.png';

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
