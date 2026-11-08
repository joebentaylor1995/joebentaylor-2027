// Imports
// ------------
import { mq } from '@tackl';
import { frameStep } from '@utils/frameClock';
import { observeScenePause } from '@utils/observeScenePause';
import { splitStega } from '@utils/stega';
import { enableParallelCompile, setClampedLinear, waitForProgram } from '@utils/webgl';
import { gsap } from 'gsap';
import type { MatrixSettings } from './interface';
import { fragment, vertex } from './shaders';

// Constants
// ------------
// Glyph atlas: one square cell per character of the title, capped
const ATLAS_CELL = 32;
const MAX_GLYPHS = 128;

const MAX_FRAME_SECONDS = 0.05;
const MAX_PIXEL_RATIO = 1.5;

// Engine
// ------------
// Raw-WebGL footer effect: one oversized triangle runs the fragment shader over the whole canvas,
// with a canvas-2D atlas of the project title's characters as the glyph texture.
// Returns a dispose function straight away; the rest of the setup runs once the shaders have
// linked. Any setup failure releases the GL resources, and dispose then has nothing left to do.
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
	enableParallelCompile(gl);

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

	// Compile and link. A shader that fails to compile fails the link, which is checked once it has finished.
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
		gl.attachShader(program, shader);
	}
	gl.linkProgram(program);

	// Everything after the link: geometry, uniforms, the glyph atlas, observers and the frame
	// loop. Returns the teardown for all of it.
	const start = () => {
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

		// Glyph atlas: each character of the title, drawn side by side
		const atlas = document.createElement('canvas');
		const letters = Array.from(`${splitStega(title).clean.trim().toUpperCase()} `).slice(0, MAX_GLYPHS);
		atlas.width = letters.length * ATLAS_CELL;
		atlas.height = ATLAS_CELL;
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
			ink.fillText(letter, i * ATLAS_CELL + ATLAS_CELL / 2, ATLAS_CELL / 2);
		});

		gl.uniform1f(gl.getUniformLocation(program, 'glyphCount'), letters.length);
		canvas.dataset.characters = letters.join('');

		// Upload the atlas (flipped vertically on upload)
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas);
		setClampedLinear(gl);

		// Animation state: target/hover ease the pointer influence, clock drives the fall, codeClock drives glyph swaps
		let target = 0,
			hover = 0,
			clock = 0,
			codeClock = 0,
			visible = false;

		// Hover reaction only on large screens with a fine hovering pointer
		const hoverMedia = matchMedia(`${mq.up.l} and (hover: hover) and (pointer: fine)`);
		let scenePaused = false;

		// Frame: advance clocks (dt capped so tab switches don't jump), upload uniforms, draw
		const draw = (_time: number, milliseconds: number) => {
			if (document.hidden || gl.isContextLost()) return;
			const state = settings();
			if (!state.enabled) {
				gl.clear(gl.COLOR_BUFFER_BIT);
				return;
			}

			// NOTE • The vsync step (see src/utils/frameClock.ts), so the rain falls evenly;
			// GSAP's own delta is whole milliseconds. Falls back to it on a run's first frame.
			const dt = Math.min((frameStep() || milliseconds) / 1000, MAX_FRAME_SECONDS);
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

			// NOTE • Only on change: at rest it's the same value every frame, and each write is an
			// attribute mutation (a global [data-hover] selector exists, so it can invalidate style)
			const hoverValue = hover.toFixed(3);
			if (canvas.dataset.hover !== hoverValue) canvas.dataset.hover = hoverValue;
			gl.drawArrays(gl.TRIANGLES, 0, 3);
		};

		// Backing store follows the CSS size, up to a capped pixel ratio
		const resize = () => {
			const ratio = Math.min(devicePixelRatio || 1, MAX_PIXEL_RATIO);
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

		// Teardown
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
	};

	// NOTE • Why: this mounts while the visitor scrolls towards the outro (1200px ahead), and
	// reading COMPILE_STATUS/LINK_STATUS straight after linking blocks the main thread until the
	// GPU process has compiled the shaders (54ms measured mid-scroll, far more on a cold cache).
	// The link finishes in parallel; the setup above waits for it. Dispose stays synchronous.
	let disposed = false;
	let stop = release;
	// A failure anywhere in setup keeps the plain background, as the synchronous setup's caller did
	const abandon = () => {
		release();
		stop = () => {};
	};
	void waitForProgram(gl, program, () => disposed)
		.then(linked => {
			if (!linked || disposed) return;
			if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return abandon();
			stop = start();
		})
		.catch(() => {
			if (!disposed) abandon();
		});

	// Dispose
	return () => {
		if (disposed) return;
		disposed = true;
		stop();
	};
}
