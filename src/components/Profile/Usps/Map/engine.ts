// Imports
// ------------

import { getSettings, subscribe } from '@parts/ProfileReveal/Settings/store';
import { gsap } from 'gsap';
import { loadGeometry } from './loadGeometry';
import { framing, projectLocation, rotation } from './projection';

// Motion
// ------------
const RETURN_SECONDS = 2;
const FOLLOW_SECONDS = 0.22;
const MAX_TILT_X = 9;
const MAX_TILT_Y = 6;
const clampLatitude = (value: number) => Math.max(-85, Math.min(85, value));

// Shaders
// ------------
const VERTEX = `
attribute vec3 position;
uniform mat3 rotation;
uniform vec2 scale;
uniform vec2 offset;
uniform float pointSize;
varying float depth;
void main() {
	vec3 p = rotation * position;
	depth = p.z;
	gl_Position = vec4(p.xy * scale + offset, 0.0, 1.0);
	gl_PointSize = pointSize;
}`;
const FRAGMENT = `
precision mediump float;
varying float depth;
uniform float opacity;
uniform bool dotted;
void main() {
	float edge = dotted ? 1.0 - smoothstep(0.30, 0.50, length(gl_PointCoord - vec2(0.5))) : 1.0;
	float visibility = depth < 0.0 ? 0.065 : 0.32 + 0.68 * pow(depth, 0.35);
	gl_FragColor = vec4(vec3(1.0), opacity * visibility * edge);
}`;

// Scene
// ------------
export async function createGlobe(element: HTMLElement, signal: AbortSignal) {
	const geometry = await loadGeometry(signal);
	signal.throwIfAborted();
	const canvasElement = element.querySelector('canvas');
	const marker = element.querySelector<HTMLElement>('[data-globe-marker]');
	if (!canvasElement || !marker) throw new Error('Globe elements missing');
	const canvas = canvasElement;
	const context = canvas.getContext('webgl', { antialias: true, alpha: true });
	if (!context) throw new Error('WebGL unavailable');
	const gl = context;
	const shaders: WebGLShader[] = [];
	const buffers: WebGLBuffer[] = [];
	const program = gl.createProgram();
	if (!program) throw new Error('Globe program unavailable');
	function releaseResources() {
		for (const buffer of buffers) gl.deleteBuffer(buffer);
		for (const shader of shaders) gl.deleteShader(shader);
		gl.deleteProgram(program);
	}
	function shader(type: number, source: string) {
		const next = gl.createShader(type);
		if (!next) throw new Error('Globe shader unavailable');
		shaders.push(next);
		gl.shaderSource(next, source);
		gl.compileShader(next);
		if (!gl.getShaderParameter(next, gl.COMPILE_STATUS))
			throw new Error(gl.getShaderInfoLog(next) ?? 'Shader compilation failed');
		return next;
	}
	let layers: { name: string; buffer: WebGLBuffer; count: number }[];
	try {
		gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
		gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Globe shader linking failed');
		// biome-ignore lint/correctness/useHookAtTopLevel: WebGL useProgram is not a React hook.
		gl.useProgram(program);
		layers = Object.entries(geometry).map(([name, positions]) => {
			const buffer = gl.createBuffer();
			if (!buffer) throw new Error('Globe buffer unavailable');
			buffers.push(buffer);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);
			return { name, buffer, count: positions.length / 3 };
		});
	} catch (error) {
		releaseResources();
		throw error;
	}
	const uniforms = Object.fromEntries(
		['rotation', 'scale', 'offset', 'pointSize', 'opacity', 'dotted'].map(name => [
			name,
			gl.getUniformLocation(program, name),
		])
	);
	const attribute = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(attribute);
	gl.enable(gl.BLEND);
	gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	gl.clearColor(0, 0, 0, 0);
	const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
	let settings = getSettings();
	const destination = () => ({ latitude: settings.globeLatitude, longitude: settings.globeLongitude });
	const start = () => ({
		latitude: clampLatitude(settings.globeLatitude + 5),
		longitude: settings.globeLongitude - 28,
	});
	let reveal = motion.matches ? 1 : 0;
	const listeners = new AbortController();
	const options = { signal: listeners.signal };
	const view = { ...(motion.matches ? destination() : start()) };
	const hover = { x: 0, y: 0, targetX: 0, targetY: 0 };
	let journey = motion.matches ? null : { from: start(), elapsed: 0, duration: settings.globeIntro };
	let drag: { id: number; x: number; y: number; latitude: number; longitude: number } | null = null;
	let visible = false,
		ticking = false,
		disposed = false,
		contextLost = false;
	let width = 1,
		height = 1;
	let frame = framing(width, height);

	function stop() {
		gsap.ticker.remove(tick);
		ticking = false;
	}
	function wake() {
		if (disposed || contextLost || !visible || document.hidden || ticking) return;
		ticking = true;
		gsap.ticker.add(tick);
	}
	function draw() {
		if (disposed || contextLost) return;
		element.style.setProperty('--map-reveal', String(reveal * reveal * (3 - 2 * reveal)));
		const matrix = rotation({
			longitude: view.longitude + hover.x,
			latitude: clampLatitude(view.latitude + hover.y),
		});
		gl.uniformMatrix3fv(uniforms.rotation, false, matrix);
		gl.clear(gl.COLOR_BUFFER_BIT);
		for (const layer of layers) {
			gl.bindBuffer(gl.ARRAY_BUFFER, layer.buffer);
			gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0);
			gl.uniform1f(uniforms.opacity, layer.name === 'grid' ? 0.32 : layer.name === 'dots' ? 0.88 : 0.8);
			gl.uniform1i(uniforms.dotted, Number(layer.name === 'dots'));
			gl.drawArrays(layer.name === 'dots' ? gl.POINTS : gl.LINES, 0, layer.count);
		}
		const location = projectLocation(matrix);
		marker?.style.setProperty('--map-x', `${frame.x + location.x * frame.radius}px`);
		marker?.style.setProperty('--map-y', `${frame.y - location.y * frame.radius}px`);
		marker?.style.setProperty('--map-opacity', String(Math.max(0, Math.min(1, (location.z - 0.05) / 0.3))));
	}
	function tick(_time: number, deltaMs: number) {
		const dt = deltaMs / 1000;
		reveal = Math.min(1, reveal + dt / settings.globeFade);
		if (journey) {
			journey.elapsed += dt;
			const t = Math.min(1, journey.elapsed / journey.duration);
			const ease = 1 - (1 - t) ** 5;
			view.latitude = journey.from.latitude + (settings.globeLatitude - journey.from.latitude) * ease;
			view.longitude = journey.from.longitude + (settings.globeLongitude - journey.from.longitude) * ease;
			if (t === 1) {
				journey = null;
				element.dataset.state = 'ready';
			}
		}
		const blend = 1 - Math.exp(-dt / FOLLOW_SECONDS);
		hover.x += (hover.targetX - hover.x) * blend;
		hover.y += (hover.targetY - hover.y) * blend;
		const settled = Math.abs(hover.targetX - hover.x) + Math.abs(hover.targetY - hover.y) < 0.001;
		if (settled) {
			hover.x = hover.targetX;
			hover.y = hover.targetY;
		}
		draw();
		if (!journey && settled && reveal === 1) stop();
	}
	function resize() {
		const bounds = element.getBoundingClientRect();
		width = Math.max(1, bounds.width);
		height = Math.max(1, bounds.height);
		const ratio = Math.min(window.devicePixelRatio || 1, 2);
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		gl.viewport(0, 0, canvas.width, canvas.height);
		frame = framing(width, height);
		frame = {
			radius: frame.radius * settings.globeZoom,
			x: width / 2 + (frame.x - width / 2) * settings.globeZoom + (width * settings.globeX) / 100,
			y: height / 2 + (frame.y - height / 2) * settings.globeZoom + (height * settings.globeY) / 100,
		};
		gl.uniform2f(uniforms.scale, (2 * frame.radius) / width, (2 * frame.radius) / height);
		gl.uniform2f(uniforms.offset, (2 * frame.x) / width - 1, 1 - (2 * frame.y) / height);
		gl.uniform1f(uniforms.pointSize, 1.65 * ratio);
		draw();
	}
	function absorbHover() {
		view.longitude += hover.x;
		view.latitude = clampLatitude(view.latitude + hover.y);
		hover.x = hover.y = hover.targetX = hover.targetY = 0;
	}
	function returnHome() {
		absorbHover();
		view.longitude =
			settings.globeLongitude + ((((view.longitude - settings.globeLongitude + 180) % 360) + 360) % 360) - 180;
		if (motion.matches) {
			Object.assign(view, destination());
			journey = null;
			element.dataset.state = 'ready';
			draw();
		} else {
			journey = { from: { ...view }, elapsed: 0, duration: RETURN_SECONDS };
			element.dataset.state = 'travelling';
			wake();
		}
	}
	function resetHover() {
		hover.targetX = hover.targetY = 0;
		wake();
	}
	canvas.addEventListener(
		'pointerdown',
		event => {
			if (event.button !== 0 || drag) return;
			journey = null;
			absorbHover();
			drag = { id: event.pointerId, x: event.clientX, y: event.clientY, ...view };
			canvas.setPointerCapture(event.pointerId);
			canvas.focus({ preventScroll: true });
			element.dataset.state = 'exploring';
		},
		options
	);
	canvas.addEventListener(
		'pointermove',
		event => {
			if (drag) {
				if (event.pointerId !== drag.id) return;
				view.longitude = drag.longitude - (event.clientX - drag.x) * 0.18;
				view.latitude = clampLatitude(drag.latitude + (event.clientY - drag.y) * 0.18);
				draw();
				return;
			}
			if (!settings.globeFollow || motion.matches || event.pointerType !== 'mouse' || event.buttons) return;
			const box = canvas.getBoundingClientRect();
			hover.targetX = -(((event.clientX - box.left) / box.width) * 2 - 1) * MAX_TILT_X;
			hover.targetY = (((event.clientY - box.top) / box.height) * 2 - 1) * MAX_TILT_Y;
			wake();
		},
		options
	);
	const release = () => {
		drag = null;
	};
	canvas.addEventListener('pointerup', release, options);
	canvas.addEventListener('pointercancel', release, options);
	canvas.addEventListener('lostpointercapture', release, options);
	canvas.addEventListener('pointerleave', resetHover, options);
	window.addEventListener('blur', resetHover, options);
	canvas.addEventListener(
		'keydown',
		event => {
			if (event.key === 'Home') {
				event.preventDefault();
				returnHome();
				return;
			}
			if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
			event.preventDefault();
			journey = null;
			absorbHover();
			view.longitude += event.key === 'ArrowLeft' ? -5 : event.key === 'ArrowRight' ? 5 : 0;
			view.latitude = clampLatitude(
				view.latitude + (event.key === 'ArrowUp' ? 5 : event.key === 'ArrowDown' ? -5 : 0)
			);
			element.dataset.state = 'exploring';
			draw();
		},
		options
	);
	motion.addEventListener(
		'change',
		() => {
			if (!motion.matches) return;
			reveal = 1;
			hover.x = hover.y = hover.targetX = hover.targetY = 0;
			if (journey) {
				Object.assign(view, destination());
				journey = null;
				element.dataset.state = 'ready';
			}
			stop();
			draw();
		},
		options
	);
	document.addEventListener(
		'visibilitychange',
		() => {
			if (document.hidden) stop();
			else wake();
		},
		options
	);
	canvas.addEventListener(
		'webglcontextlost',
		event => {
			event.preventDefault();
			contextLost = true;
			stop();
			element.dataset.state = 'error';
		},
		options
	);
	const observer = new ResizeObserver(resize);
	const unsubscribe = subscribe(() => {
		const next = getSettings();
		const changed = (Object.keys(next) as (keyof typeof next)[]).some(
			key =>
				key.startsWith('globe') &&
				!key.startsWith('globeDot') &&
				!key.startsWith('globePulse') &&
				next[key] !== settings[key]
		);
		settings = next;
		if (!changed) return;
		journey = null;
		reveal = 1;
		hover.x = hover.y = hover.targetX = hover.targetY = 0;
		Object.assign(view, destination());
		element.dataset.state = 'ready';
		resize();
	});
	window.addEventListener(
		'modal-settings-replay',
		() => {
			hover.x = hover.y = hover.targetX = hover.targetY = 0;
			reveal = motion.matches ? 1 : 0;
			Object.assign(view, motion.matches ? destination() : start());
			journey = motion.matches ? null : { from: start(), elapsed: 0, duration: settings.globeIntro };
			element.dataset.state = journey ? 'travelling' : 'ready';
			draw();
			wake();
		},
		options
	);
	observer.observe(element);
	element.dataset.state = journey ? 'travelling' : 'ready';
	resize();
	return {
		setVisible(next: boolean) {
			visible = next;
			if (next) wake();
			else {
				stop();
				drag = null;
				hover.targetX = hover.targetY = 0;
			}
		},
		destroy() {
			if (disposed) return;
			disposed = true;
			unsubscribe();
			stop();
			listeners.abort();
			observer.disconnect();
			if (drag && canvas.hasPointerCapture(drag.id)) canvas.releasePointerCapture(drag.id);
			releaseResources();
			element.style.removeProperty('--map-reveal');
			gl.clear(gl.COLOR_BUFFER_BIT);
			marker.style.removeProperty('--map-x');
			marker.style.removeProperty('--map-y');
			marker.style.removeProperty('--map-opacity');
		},
	};
}
