// Imports
// ------------
import { mq } from '@tackl';
import { observeScenePause } from '@utils/observeScenePause';
import { splitStega } from '@utils/stega';
import { gsap } from 'gsap';
import type { MatrixSettings } from './interface';
import { fragment, vertex } from './shaders';

// Engine
// ------------
// Raw-WebGL footer effect: one oversized triangle runs the fragment shader over the whole canvas,
// with a canvas-2D atlas of the project title's characters as the glyph texture.
// Returns a dispose function; any setup failure releases GL resources and returns a no-op.
export function createMatrixFooter(
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	title: string,
	settings: () => MatrixSettings
) {
	// GL context + resources
	const gl = canvas.getContext('webgl', {
		alpha: true,
		depth: false,
		antialias: false,
		powerPreference: 'low-power',
	});
	if (!gl) return () => {};

	const program = gl.createProgram(),
		buffer = gl.createBuffer(),
		texture = gl.createTexture();
	const shaders: WebGLShader[] = [];

	// Frees everything created so far; safe to call after a partial setup
	const release = () => {
		gl.deleteProgram(program);
		gl.deleteBuffer(buffer);
		gl.deleteTexture(texture);
		for (const shader of shaders) gl.deleteShader(shader);
	};
	if (!program || !buffer || !texture) {
		release();
		return () => {};
	}

	// Compile and link
	for (const [type, source] of [
		[gl.VERTEX_SHADER, vertex],
		[gl.FRAGMENT_SHADER, fragment],
	] as const) {
		const shader = gl.createShader(type);
		if (!shader) {
			release();
			return () => {};
		}
		shaders.push(shader);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
			release();
			return () => {};
		}
		gl.attachShader(program, shader);
	}

	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		release();
		return () => {};
	}

	// Geometry: a single clip-space triangle that overshoots the viewport (covers it without a diagonal seam)
	// biome-ignore lint/correctness/useHookAtTopLevel: WebGL method.
	gl.useProgram(program);
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
	const position = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

	// Uniform locations, looked up once
	const uniforms = Object.fromEntries(
		[
			'size',
			'time',
			'codeTime',
			'hover',
			'cellSize',
			'intensity',
			'hoverGlow',
			'hoverSize',
			'hoverDrift',
			'hoverPulse',
		].map(name => [name, gl.getUniformLocation(program, name)])
	);

	// Glyph atlas: each character of the title (capped at 128) in a 32px cell, drawn side by side
	const atlas = document.createElement('canvas');
	const letters = Array.from(`${splitStega(title).clean.trim().toUpperCase()} `).slice(0, 128);
	atlas.width = letters.length * 32;
	atlas.height = 32;
	const ink = atlas.getContext('2d');
	if (!ink) {
		release();
		return () => {};
	}

	ink.fillStyle = 'white';
	ink.font = '25px monospace';
	ink.textAlign = 'center';
	ink.textBaseline = 'middle';
	letters.forEach((letter, i) => {
		ink.fillText(letter, i * 32 + 16, 16);
	});

	gl.uniform1f(gl.getUniformLocation(program, 'glyphCount'), letters.length);
	canvas.dataset.characters = letters.join('');

	// Upload the atlas (flipped vertically on upload)
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

	// Animation state: target/hover ease the pointer influence, clock drives the fall, codeClock drives glyph swaps
	let target = 0,
		hover = 0,
		clock = 0,
		codeClock = 0,
		visible = false;

	// Hover reaction only on large screens with a fine hovering pointer
	const hoverMedia = matchMedia(`${mq.up.l} and (hover: hover) and (pointer: fine)`);
	let scenePaused = false;

	// Frame: advance clocks (dt capped at 50ms so tab switches don't jump), upload uniforms, draw
	const draw = (_time: number, milliseconds: number) => {
		if (document.hidden || gl.isContextLost()) return;
		const state = settings();
		if (!state.enabled) {
			gl.clear(gl.COLOR_BUFFER_BIT);
			return;
		}

		const dt = Math.min(milliseconds / 1000, 0.05);
		hover = hoverMedia.matches
			? hover + ((state.hoverEnabled ? target : 0) - hover) * (1 - Math.exp(-dt / state.hoverDuration))
			: 0;

		const speed = 1 + hover * (state.hoverSpeed - 1);
		clock += dt * state.speed * speed;
		codeClock += dt * state.speed * (1 + hover * (state.hoverScramble - 1));

		gl.uniform1f(uniforms.hoverGlow, state.hoverGlow);
		gl.uniform1f(uniforms.hoverSize, state.hoverSize);
		gl.uniform1f(uniforms.hoverDrift, state.hoverDrift);
		gl.uniform1f(uniforms.hoverPulse, state.hoverPulse);
		gl.uniform1f(uniforms.time, clock);
		gl.uniform1f(uniforms.codeTime, codeClock);
		gl.uniform1f(uniforms.hover, hover);
		gl.uniform1f(uniforms.cellSize, state.size);
		gl.uniform1f(uniforms.intensity, state.intensity);

		canvas.dataset.hover = hover.toFixed(3);
		gl.drawArrays(gl.TRIANGLES, 0, 3);
	};

	// Backing store follows the CSS size at up to 1.5x pixel ratio
	const resize = () => {
		const ratio = Math.min(devicePixelRatio || 1, 1.5);
		canvas.width = Math.max(1, Math.round(canvas.clientWidth * ratio));
		canvas.height = Math.max(1, Math.round(canvas.clientHeight * ratio));
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.uniform2f(uniforms.size, canvas.clientWidth, canvas.clientHeight);
	};

	// Hovering or focusing the next-project link drives the hover effect
	const enter = () => {
			target = hoverMedia.matches ? 1 : 0;
		},
		leave = () => {
			target = 0;
		};

	const next = host.querySelector('[data-next-project]');
	next?.addEventListener('pointerenter', enter);
	next?.addEventListener('pointerleave', leave);
	next?.addEventListener('focus', enter);
	next?.addEventListener('blur', leave);

	const size = new ResizeObserver(resize);
	size.observe(canvas);
	resize();

	// Only tick while on screen, not paused by the scene and the tab is visible
	const visibility = new IntersectionObserver(entries => {
		const entry = entries[entries.length - 1];
		if (entry.isIntersecting === visible) return;
		visible = entry.isIntersecting;
		syncTicker();
	});
	const syncTicker = () => {
		gsap.ticker.remove(draw);
		if (visible && !scenePaused && !document.hidden) gsap.ticker.add(draw);
	};

	const stopObservingPause = observeScenePause(host, paused => {
		scenePaused = paused;
		syncTicker();
	});

	document.addEventListener('visibilitychange', syncTicker);
	visibility.observe(canvas);
	canvas.dataset.ready = 'true';

	// Dispose
	return () => {
		gsap.ticker.remove(draw);
		size.disconnect();
		visibility.disconnect();
		stopObservingPause();
		document.removeEventListener('visibilitychange', syncTicker);
		next?.removeEventListener('pointerenter', enter);
		next?.removeEventListener('pointerleave', leave);
		next?.removeEventListener('focus', enter);
		next?.removeEventListener('blur', leave);
		delete canvas.dataset.ready;
		release();
	};
}
