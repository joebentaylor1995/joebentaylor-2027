// Imports
// ------------
import { MOBILE_COLOUR_DURATION, MOBILE_SCALE_DURATION, MOBILE_SCALE_EASE } from '@parts/SiteLoader/mobile-intro';
import { gsap } from 'gsap';
import { HERO_DESKTOP_QUERY } from '../layout';
import { drawHeroContent } from './hero-content-texture';
import type { LiquidSettings } from './liquid-settings';
import * as shaders from './liquid-shaders';
import { createLabelTransition, drawMarqueeDecoration, marqueePhrases } from './marquee-decoration';
import { introDefaults, introSettings, sceneIntros } from './scene-intro';

// Constants
// ------------
const LABEL_TRANSITION_SECONDS = 0.7;

// Types
// ------------
interface Target {
	texture: WebGLTexture;
	fbo: WebGLFramebuffer;
	width: number;
	height: number;
}
interface Program {
	program: WebGLProgram;
	position: number;
	uniforms: Record<string, WebGLUniformLocation | null>;
}
type Value = number | number[] | { texture: WebGLTexture };
export interface LiquidLayer {
	resize: () => void;
	beginPortrait: () => void;
	draw: (dt: number, scrollVelocity: number, gesture: number) => void;
	// True when draw() would only repaint the frame already on the canvas
	isStatic: () => boolean;
	move: (x: number, y: number) => void;
	resetPointer: () => void;
	destroy: () => void;
}
// What the display pass was last drawn with (see isStatic)
interface DisplayState {
	introColour: number;
	waterReveal: number;
	inFront: number;
	fluidActive: number;
}

// Constants
// ------------
// Yields between shader compile checks, so the page never blocks
const COMPILE_YIELD_MS = 16;
const MAX_SIM_LONG_SIDE = 768;
const DEFAULT_MARQUEE_DURATION = 48;
const MAX_LOGO_RASTER_RATIO = 2;
const MAX_QUEUED_SEGMENTS = 24;
// Scroll slower than this keeps the marquee's current direction
const DIRECTION_VELOCITY_THRESHOLD = 0.005;
// Caps the sim step so a long frame can't destabilise it
const MAX_SIM_DT = 0.025;
// The sim runs for this many seconds after the last pointer movement, then idles
const FLUID_ACTIVE_SECONDS = 12;
// Pointer segments shorter than this (CSS px) are skipped
const MIN_SPLAT_DISTANCE = 0.2;
const SPLAT_RADIUS_SCALE = 0.65;
const SPLAT_RADIUS_BASE = 12;
// Water raised per splat: a base plus a share of the distance moved, up to a maximum
const SPLAT_HEIGHT_BASE = 0.1;
const SPLAT_HEIGHT_PER_PX = 0.004;
const SPLAT_HEIGHT_MAX = 0.4;
// Water height decay rate, lowered as settings.persistence rises
const HEIGHT_DECAY_BASE = 2.4;
const HEIGHT_DECAY_PERSISTENCE = 0.02;
// Extra portrait scale at the start of the mobile intro
const MOBILE_INTRO_ZOOM = 0.45;

// Helpers
// ------------
// Hands the main thread back for a moment
const nextTask = () => new Promise(resolve => setTimeout(resolve, 0));

// Renderer
// ------------
// NOTE • The hero's WebGL layer: a portrait, the logo marquee and the hero text are
// composited into a `scene` texture, then a display pass adds the intro water wave and,
// on desktop, a pointer-driven fluid sim (velocity, height, pressure) that refracts it.
// Phones skip the sim and float textures. Throws if the GPU can't do what's needed.
// `beforeFirstRaster` runs just before the layer first reads the DOM for its textures.
export async function createLiquidLayer(
	gl: WebGLRenderingContext,
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	settings: LiquidSettings,
	isCancelled = () => false,
	portraitOnly = false,
	desktopQuery = HERO_DESKTOP_QUERY,
	beforeFirstRaster = () => {}
): Promise<LiquidLayer> {
	// Capability checks: desktop needs filtered float textures for the sim
	const bindProgram = gl.useProgram.bind(gl);
	const desktopLayout = window.matchMedia(desktopQuery);
	const mobile = !desktopLayout.matches;
	const parallel = gl.getExtension('KHR_parallel_shader_compile');
	if (!mobile && (!gl.getExtension('OES_texture_float') || !gl.getExtension('OES_texture_float_linear'))) {
		throw new Error('Liquid glass requires filtered float textures');
	}
	if (!mobile) gl.getExtension('WEBGL_color_buffer_float');
	const trackElement = host.querySelector<HTMLElement>('[data-logo-track]');
	if (!trackElement && !portraitOnly) throw new Error('Logo track missing');
	const track = trackElement;
	const images = Array.from(track?.querySelectorAll('img') ?? []);
	if (!mobile && images.some(image => !image.complete || !image.naturalWidth))
		throw new Error('Logo textures not ready');

	// GPU resources are tracked here so destroy() can free every one
	const textures = new Set<WebGLTexture>();
	const targets = new Set<Target>();
	const programs: WebGLProgram[] = [];
	const buffer = gl.createBuffer();
	if (!buffer) throw new Error('Unable to allocate liquid quad');

	// Pointer segments waiting for the next draw, and the sim's activity timer
	let previous: [number, number] | null = null;
	let queued: [number, number, number, number][] = [];
	let activeTime = 0;
	// Marquee scroll position (0 to 1 around one loop) and its direction
	let phase = 0;
	let direction = 1;
	let phaseInitialized = false;

	// Marquee strip metrics in CSS px, measured from the DOM in resize()
	let stripWidth = 1,
		stripHeight = 1,
		bottom = 0,
		duration = DEFAULT_MARQUEE_DURATION;
	let cssWidth = canvas.clientWidth,
		cssHeight = canvas.clientHeight;
	let background = [0, 0, 0];
	let revealDark = [0, 0, 0];

	// Render targets: the portrait and composited scene, then the sim's velocity / height / pressure pairs
	let portrait: Target,
		scene: Target,
		velocity: ReturnType<typeof pair>,
		height: ReturnType<typeof pair>,
		pressure: ReturnType<typeof pair>,
		divergence: Target,
		curl: Target;
	let simWidth = 1,
		simHeight = 1;
	// One texel of the sim grid, shared by every pass
	let px = [1, 1];
	const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;

	// NOTE • Whether anything feeding the scene (the portrait or a DOM texture) changed since
	// the last draw, and what the display pass last showed: together they tell isStatic()
	// when a phone's frame would come out identical
	let sceneChanged = true;
	let displayed: DisplayState | null = null;

	// Colour reads must not flush the large, GPU-backed logo raster.
	const colourRaster = document.createElement('canvas');
	colourRaster.width = colourRaster.height = 1;
	const colourContext = colourRaster.getContext('2d', { willReadFrequently: true });
	if (!colourContext) throw new Error('Unable to resolve scene colours');
	const resolveColour = (colour: string) => {
		colourContext.clearRect(0, 0, 1, 1);
		colourContext.fillStyle = colour;
		colourContext.fillRect(0, 0, 1, 1);
		return Array.from(colourContext.getImageData(0, 0, 1, 1).data)
			.slice(0, 3)
			.map(n => n / 255);
	};

	// Frees every GPU resource this layer created
	function destroy() {
		for (const target of targets) gl.deleteFramebuffer(target.fbo);
		for (const texture of textures) gl.deleteTexture(texture);
		for (const program of programs) gl.deleteProgram(program);
		gl.deleteBuffer(buffer);
		targets.clear();
		textures.clear();
	}

	// Compiles and links a fragment body with the shared vertex shader, yielding between steps so the page never blocks
	async function makeProgram(body: string): Promise<Program> {
		const program = gl.createProgram();
		if (!program) throw new Error('Unable to allocate liquid program');
		programs.push(program);
		for (const [type, source] of [
			[gl.VERTEX_SHADER, shaders.liquidVertex],
			[gl.FRAGMENT_SHADER, shaders.header + body],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Unable to allocate liquid shader');
			gl.shaderSource(shader, source);
			gl.compileShader(shader);
			gl.attachShader(program, shader);
			gl.deleteShader(shader);
		}
		gl.linkProgram(program);
		// Give the GPU time to compile without synchronously blocking the page.
		do {
			await new Promise(resolve => setTimeout(resolve, COMPILE_YIELD_MS));
			if (isCancelled() || gl.isContextLost()) throw new Error('Liquid initialization cancelled');
		} while (parallel && !gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR));
		if (!gl.getProgramParameter(program, gl.LINK_STATUS))
			throw new Error(gl.getProgramInfoLog(program) || 'Liquid link failed');
		const uniforms: Program['uniforms'] = {};
		for (let i = 0; i < gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS); i++) {
			const info = gl.getActiveUniform(program, i);
			if (info) uniforms[info.name] = gl.getUniformLocation(program, info.name);
		}
		return { program, uniforms, position: gl.getAttribLocation(program, 'position') };
	}

	// A linear-filtered, edge-clamped texture, tracked for cleanup
	function texture() {
		const result = gl.createTexture();
		if (!result) throw new Error('Unable to allocate liquid texture');
		textures.add(result);
		gl.bindTexture(gl.TEXTURE_2D, result);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		return result;
	}

	// A texture plus the framebuffer that renders into it
	function target(width: number, height: number, type: number): Target {
		const tex = texture(),
			fbo = gl.createFramebuffer();
		if (!fbo) throw new Error('Unable to allocate liquid framebuffer');
		const result = { texture: tex, fbo, width, height };
		targets.add(result);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, type, null);
		gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
		gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
		if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE)
			throw new Error('Liquid framebuffer unsupported');
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		return result;
	}

	// Ping-pong buffers: read from one, write to the other, then swap()
	function pair() {
		return {
			read: target(simWidth, simHeight, gl.FLOAT),
			write: target(simWidth, simHeight, gl.FLOAT),
			swap() {
				[this.read, this.write] = [this.write, this.read];
			},
		};
	}

	// NOTE • A program keeps its uniform values between draws, so a uniform is only sent
	// again when its value differs from the one it last received (compared exactly, -0 too)
	const uniformValues = new Map<WebGLUniformLocation, number | number[]>();
	function setUniform(location: WebGLUniformLocation, value: number | number[]) {
		const last = uniformValues.get(location);
		if (typeof value === 'number') {
			if (Object.is(last, value)) return;
			gl.uniform1f(location, value);
			uniformValues.set(location, value);
			return;
		}
		if (Array.isArray(last) && last.length === value.length && last.every((v, i) => Object.is(v, value[i]))) return;
		if (value.length === 2) gl.uniform2fv(location, value);
		else if (value.length === 4) gl.uniform4fv(location, value);
		else gl.uniform3fv(location, value);
		uniformValues.set(location, value.slice());
	}
	function setSampler(location: WebGLUniformLocation, unit: number) {
		if (uniformValues.get(location) === unit) return;
		gl.uniform1i(location, unit);
		uniformValues.set(location, unit);
	}

	// Runs a program over the full screen into `dest` (null is the canvas). Uniforms are bound by name: numbers, 2 to 4 component vectors, or textures.
	function draw(p: Program, dest: Target | null, values: Record<string, Value>) {
		bindProgram(p.program);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(p.position);
		gl.vertexAttribPointer(p.position, 2, gl.FLOAT, false, 0, 0);
		gl.bindFramebuffer(gl.FRAMEBUFFER, dest?.fbo ?? null);
		gl.viewport(0, 0, dest?.width ?? canvas.width, dest?.height ?? canvas.height);
		let unit = 0;
		// `px` first, unless the pass gives its own, then the pass's values in order
		if (p.uniforms.px && !('px' in values)) setUniform(p.uniforms.px, px);
		for (const key in values) {
			const location = p.uniforms[key];
			if (!location) continue;
			const value = values[key];
			if (typeof value === 'number' || Array.isArray(value)) setUniform(location, value);
			else {
				gl.activeTexture(gl.TEXTURE0 + unit);
				gl.bindTexture(gl.TEXTURE_2D, value.texture);
				setSampler(location, unit++);
			}
		}
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	// NOTE • Uploads a DOM raster, flipped for GL. Once a texture holds a raster of the same
	// size, texSubImage2D replaces its pixels in place: the same texels as texImage2D, without
	// reallocating the texture. `rasterise` runs once the upload state is set.
	const uploadedSizes = new WeakMap<WebGLTexture, { width: number; height: number }>();
	function uploadDomTexture(tex: WebGLTexture, rasterise: () => HTMLCanvasElement) {
		gl.bindTexture(gl.TEXTURE_2D, tex);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		try {
			const raster = rasterise();
			const size = uploadedSizes.get(tex);
			if (size?.width === raster.width && size.height === raster.height)
				gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, raster);
			else {
				gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, raster);
				uploadedSizes.set(tex, { width: raster.width, height: raster.height });
			}
		} finally {
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		}
		sceneChanged = true;
	}

	// Setup: compile the programs, allocate the textures and targets, then hand back the layer. Any failure frees the partial layer.
	try {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
		// Passes: the fluid sim steps, then composite (builds `scene`) and display (to screen).
		// Mobile compiles only the last two.
		// NOTE • A portrait-only layer (the project hero) has no composite: its scene would be a
		// texel-for-texel copy of the portrait, so the display pass reads the portrait itself
		const names = [
			'advect',
			'splat',
			'curl',
			'vorticity',
			'divergence',
			'pressure',
			'gradient',
			'composite',
			'display',
		] as const;
		const activeNames = names.filter(name =>
			name === 'composite' ? !portraitOnly : !mobile || name === 'display'
		);
		const sources = {
			advect: shaders.advect,
			splat: shaders.splat,
			curl: shaders.curl,
			vorticity: shaders.vorticity,
			divergence: shaders.divergence,
			pressure: shaders.pressure,
			gradient: shaders.gradient,
			composite: mobile ? shaders.mobileComposite : shaders.composite,
			display: shaders.display,
		};
		// Drivers can compile synchronously even with the parallel extension present.
		// Submit one program per yielded task instead of blocking on all nine at once.
		const compiled: Program[] = [];
		for (const name of activeNames) compiled.push(await makeProgram(sources[name]));
		const passes = Object.fromEntries(activeNames.map((name, index) => [name, compiled[index]])) as Record<
			(typeof names)[number],
			Program
		>;

		// Textures fed from DOM rasters: the logo strip, the marquee label and the hero text
		const logos = { texture: texture() };
		const decoration = { texture: texture() };
		let labelGesture = 0;
		const phraseFor = (gesture: number) => marqueePhrases[gesture % marqueePhrases.length];
		let labelTransition: {
			from: string;
			to: string;
			elapsed: number;
			frame?: ReturnType<typeof createLabelTransition>;
		} | null = null;
		const labelPatch = document.createElement('canvas');
		const stepLabelTransition = (dt: number) => {
			if (!labelTransition) return;
			labelTransition.elapsed += dt;
			const progress = Math.min(1, labelTransition.elapsed / LABEL_TRANSITION_SECONDS);
			// The label's layout is read on the transition's first frame (see createLabelTransition)
			labelTransition.frame ??= createLabelTransition(
				canvas,
				host,
				maxTexture,
				labelTransition.from,
				labelTransition.to
			);
			const at = labelTransition.frame(progress, labelPatch);
			if (at) {
				gl.bindTexture(gl.TEXTURE_2D, decoration.texture);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				try {
					gl.texSubImage2D(gl.TEXTURE_2D, 0, at.x, at.y, gl.RGBA, gl.UNSIGNED_BYTE, labelPatch);
				} finally {
					gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
				}
			}
			if (progress === 1) labelTransition = null;
		};
		// One canvas object reused between rasters (its pixels are released after each upload)
		const decorationRaster = document.createElement('canvas');
		const rasteriseDecoration = () =>
			drawMarqueeDecoration(canvas, host, maxTexture, phraseFor(labelGesture), decorationRaster);
		// Redraws the marquee label (cycling the phrase per scroll gesture) and uploads it
		const uploadDecoration = () => {
			if (mobile || portraitOnly) return;
			labelTransition = null;
			uploadDomTexture(decoration.texture, rasteriseDecoration);
			// Refreshes are rare (resize, fonts, theme), so the full-canvas backing store isn't kept
			// between them; drawMarqueeDecoration sizes the raster again every time
			decorationRaster.width = decorationRaster.height = 0;
		};
		const content = { texture: texture() };
		const textRaster = document.createElement('canvas');
		// Mobile text stays in the DOM: no layout reads or full-screen uploads per frame.
		if (!desktopLayout.matches) textRaster.width = textRaster.height = 1;
		const textElement = host.querySelector<HTMLElement>('[data-hero-content]');
		let textFrame: string | undefined;
		let allocatedResolution = settings.resolution;
		let allocatedWidth = 0;
		let allocatedHeight = 0;
		// NOTE • The resize raster reuses the per-frame canvas: drawHeroContent clears it and
		// redraws everything, so the pixels match a fresh canvas
		const rasteriseTextOnResize = () =>
			desktopLayout.matches && !portraitOnly ? drawHeroContent(canvas, host, maxTexture, textRaster) : textRaster;
		const rasteriseTextOnFrame = () => drawHeroContent(canvas, host, maxTexture, textRaster);

		// Frees the current targets and allocates a fresh set at the current sizes
		const allocateTargets = () => {
			for (const t of targets) {
				gl.deleteFramebuffer(t.fbo);
				gl.deleteTexture(t.texture);
				textures.delete(t.texture);
			}
			targets.clear();
			portrait = target(canvas.width, canvas.height, gl.UNSIGNED_BYTE);
			scene = portraitOnly ? portrait : target(canvas.width, canvas.height, gl.UNSIGNED_BYTE);
			if (mobile) {
				// The radial intro needs no fluid simulation or float render targets.
				// A valid sampler is still required by WebGL even with fluidActive = 0.
				height = { read: portrait, write: portrait, swap() {} };
			} else {
				velocity = pair();
				height = pair();
				pressure = pair();
				divergence = target(simWidth, simHeight, gl.FLOAT);
				curl = target(simWidth, simHeight, gl.FLOAT);
			}
		};

		// Text, font and entrance refreshes share the resize path with viewport resizes.
		// Keep the live water state unless the render targets actually need a new size.
		const syncTargetSizes = () => {
			// Sim grid size: settings.resolution on the short side, capped on the long side
			const scale = Math.min(
				settings.resolution / Math.min(cssWidth, cssHeight),
				MAX_SIM_LONG_SIDE / Math.max(cssWidth, cssHeight)
			);
			const nextSimWidth = Math.max(1, Math.round(cssWidth * scale));
			const nextSimHeight = Math.max(1, Math.round(cssHeight * scale));
			if (
				allocatedWidth === canvas.width &&
				allocatedHeight === canvas.height &&
				simWidth === nextSimWidth &&
				simHeight === nextSimHeight
			)
				return;
			allocatedWidth = canvas.width;
			allocatedHeight = canvas.height;
			simWidth = nextSimWidth;
			simHeight = nextSimHeight;
			px = [1 / simWidth, 1 / simHeight];
			allocateTargets();
			previous = null;
			queued = [];
			activeTime = 0;
		};

		// Picks up the CSS animation's position the first time the marquee is measured
		const initMarqueePhase = (logoTrack: HTMLElement) => {
			if (phaseInitialized) return;
			const animation = logoTrack.getAnimations()[0];
			phase = typeof animation?.currentTime === 'number' ? animation.currentTime / 1000 / duration : 0;
			phaseInitialized = true;
		};

		// Paints the logo strip's images into a 2D canvas at their on-screen positions
		const paintLogoStrip = (bounds: DOMRect) => {
			const raster = document.createElement('canvas');
			const ratio = Math.min(MAX_LOGO_RASTER_RATIO, maxTexture / Math.max(stripWidth, stripHeight));
			raster.width = Math.max(1, Math.ceil(stripWidth * ratio));
			raster.height = Math.max(1, Math.ceil(stripHeight * ratio));
			const ctx = raster.getContext('2d');
			if (!ctx) throw new Error('Logo texture canvas unavailable');
			ctx.scale(raster.width / stripWidth, raster.height / stripHeight);
			for (const image of images) {
				const r = image.getBoundingClientRect(),
					s = getComputedStyle(image);
				ctx.globalAlpha = Number(s.opacity);
				ctx.filter = s.filter;
				ctx.drawImage(image, r.left - bounds.left, r.top - bounds.top, r.width, r.height);
			}
			return raster;
		};

		// Measures the strip and uploads its logos. Every animation frame scrolls this texture on the GPU.
		const rasteriseLogos = (logoTrack: HTMLElement) => {
			const bounds = logoTrack.getBoundingClientRect(),
				hostBounds = canvas.getBoundingClientRect();
			const style = getComputedStyle(logoTrack);
			stripWidth = bounds.width + (parseFloat(style.columnGap) || 0);
			stripHeight = Math.max(1, bounds.height);
			bottom = hostBounds.bottom - bounds.bottom;
			duration = parseFloat(style.animationDuration) || DEFAULT_MARQUEE_DURATION;
			initMarqueePhase(logoTrack);
			const raster = paintLogoStrip(bounds);
			uploadDomTexture(logos.texture, () => raster);
		};

		// Rasterise only on layout/content changes
		const rasteriseMarquee = (logoTrack: HTMLElement) => {
			rasteriseLogos(logoTrack);
			uploadDecoration();
		};

		// Resolve token colours through the browser, including modern CSS colour syntax.
		const resolveSceneColours = () => {
			background = resolveColour(getComputedStyle(host).backgroundColor);
			const cover = host.querySelector<HTMLElement>('[data-scene-cover]');
			revealDark = portraitOnly
				? background
				: resolveColour(cover ? getComputedStyle(cover).backgroundColor : getComputedStyle(host).color);
		};

		// A resize in three parts, run back to back by resize(). Cached routes can briefly
		// have no layout: zero dimensions produce NaN simulation sizes and incomplete
		// framebuffers, so the existing targets are kept and nothing is redrawn.
		const startResize = () => {
			if (gl.isContextLost() || canvas.clientWidth <= 0 || canvas.clientHeight <= 0) return false;
			cssWidth = canvas.clientWidth;
			cssHeight = canvas.clientHeight;
			syncTargetSizes();
			allocatedResolution = settings.resolution;
			sceneChanged = true;
			return true;
		};
		const hasMarquee = !mobile && !portraitOnly && track;
		const finishResize = () => {
			uploadDomTexture(content.texture, rasteriseTextOnResize);
			resolveSceneColours();
			textFrame = textElement?.dataset.textFrame;
		};

		// Reallocates targets only when a size changed, then re-rasterises the DOM textures
		function resize() {
			if (!startResize()) return;
			if (hasMarquee) rasteriseMarquee(hasMarquee);
			finishResize();
		}

		// NOTE • The first build happens before the layer is handed back, so nothing draws
		// from it yet: on desktop its targets, logos, label and text are built in separate
		// tasks instead of one long one. Each part reads the DOM as it stands; anything that
		// changes meanwhile flags the renderer's next resize (beforeFirstRaster only clears
		// flags raised before these reads).
		beforeFirstRaster();
		if (!hasMarquee) resize();
		else if (startResize()) {
			const steps = [() => rasteriseLogos(hasMarquee), uploadDecoration, finishResize];
			for (const step of steps) {
				await nextTask();
				if (isCancelled() || gl.isContextLost()) throw new Error('Liquid initialization cancelled');
				step();
			}
			// The CSS marquee kept moving across those tasks: hand over from where it is now
			phaseInitialized = false;
			initMarqueePhase(hasMarquee);
		}

		// Re-rasterise the hero text only when the entrance bumps data-text-frame
		const refreshHeroText = () => {
			if (portraitOnly || !desktopLayout.matches || textFrame === textElement?.dataset.textFrame) return;
			textFrame = textElement?.dataset.textFrame;
			uploadDomTexture(content.texture, rasteriseTextOnFrame);
		};

		// Keep gentle scrolling sharp; ramp blur gradually above moderate velocity.
		const marqueeBlurAmount = (scrollVelocity: number) =>
			Math.min(
				1,
				Math.max(
					0,
					(Math.abs(scrollVelocity) - settings.marqueeBlurThreshold) / (1 - settings.marqueeBlurThreshold)
				)
			) ** settings.marqueeBlurCurve;

		// Marquee phase: base speed plus the intro boost plus a scroll-speed boost, running the way the page last scrolled
		const advanceMarquee = (dt: number, scrollVelocity: number) => {
			if (!settings.marqueeReverse) direction = 1;
			else if (Math.abs(scrollVelocity) > DIRECTION_VELOCITY_THRESHOLD) direction = Math.sign(scrollVelocity);
			phase =
				(phase +
					(direction *
						(settings.marqueeSpeed +
							(sceneIntros.get(host)?.marqueeBoost ?? 0) +
							Math.abs(scrollVelocity) * settings.marqueeScrollBoost) *
						dt) /
						duration +
					1) %
				1;
		};

		// Turns each queued pointer segment into velocity and water-height splats
		const applyQueuedSplats = () => {
			for (const [x, y, ox, oy] of queued.splice(0)) {
				const distance = Math.hypot((x - ox) * cssWidth, (y - oy) * cssHeight);
				if (distance < MIN_SPLAT_DISTANCE) continue;
				const common = {
					point: [x, y],
					previous: [ox, oy],
					aspect: [cssWidth / cssHeight, 1],
					radius: ((settings.size * SPLAT_RADIUS_SCALE + SPLAT_RADIUS_BASE) / cssHeight) ** 2,
				};
				draw(passes.splat, velocity.write, {
					...common,
					source: velocity.read,
					amount: [(x - ox) * simWidth * settings.force, (y - oy) * simHeight * settings.force, 0],
				});
				velocity.swap();
				draw(passes.splat, height.write, {
					...common,
					source: height.read,
					amount: [
						Math.min(SPLAT_HEIGHT_MAX, SPLAT_HEIGHT_BASE + distance * SPLAT_HEIGHT_PER_PX) *
							settings.density,
						0,
						0,
					],
				});
				height.swap();
			}
		};

		// Fluid step: curl and vorticity, pressure solve, subtract the gradient, then advect velocity and height
		const solveFluid = (dt: number) => {
			draw(passes.curl, curl, { source: velocity.read });
			draw(passes.vorticity, velocity.write, {
				source: velocity.read,
				rotation: curl,
				dt,
				swirl: settings.swirl,
			});
			velocity.swap();
			draw(passes.divergence, divergence, { source: velocity.read });
			for (let i = 0; i < settings.pressureIterations; i++) {
				draw(passes.pressure, pressure.write, { source: pressure.read, divergence });
				pressure.swap();
			}
			draw(passes.gradient, velocity.write, { source: velocity.read, pressure: pressure.read });
			velocity.swap();
			draw(passes.advect, velocity.write, {
				source: velocity.read,
				flow: velocity.read,
				dt,
				decay: Math.exp(-dt * settings.resistance),
			});
			velocity.swap();
			draw(passes.advect, height.write, {
				source: height.read,
				flow: velocity.read,
				dt,
				decay: Math.exp(-dt * (HEIGHT_DECAY_BASE - settings.persistence * HEIGHT_DECAY_PERSISTENCE)),
			});
			height.swap();
		};

		const stepFluid = (dt: number) => {
			if (queued.length) activeTime = FLUID_ACTIVE_SECONDS;
			if (activeTime <= 0) return;
			activeTime -= dt;
			applyQueuedSplats();
			solveFluid(dt);
		};

		// Composite the portrait, logo strip, label and hero text into `scene` (or, see
		// draw(), straight onto the canvas)
		const drawScene = (blurAmount: number, inFront: number, dest: Target | null) => {
			draw(passes.composite, dest, {
				source: portrait,
				inFront,
				mobile: Number(!desktopLayout.matches),
				logos,
				decoration,
				content,
				background,
				screen: [cssWidth, cssHeight],
				strip: [stripWidth, stripHeight],
				bottom,
				phase,
				logoBlur: (blurAmount * settings.marqueeBlur) / stripWidth,
			});
		};

		// Recover elapsed progress from the colour's sine easing once per frame.
		// The zoom throws quickly, settling before the slower colour fade.
		const mobileZoomRemaining = (introColour: number) => {
			const introTime = Math.acos(Math.max(-1, Math.min(1, 2 * introColour - 1))) / Math.PI;
			const zoomProgress = Math.min(1, (introTime * MOBILE_COLOUR_DURATION) / MOBILE_SCALE_DURATION);
			return 1 - gsap.parseEase(MOBILE_SCALE_EASE)(zoomProgress);
		};

		// Final pass to the canvas: the intro water wave and lens, plus the liquid refraction
		const drawToScreen = (state: DisplayState, introZoom: number) => {
			const waveConfig = introSettings.get(host) ?? introDefaults;
			draw(passes.display, null, {
				source: height.read,
				scene,
				portrait,
				content,
				waterReveal: state.waterReveal,
				introColour: state.introColour,
				introZoom,
				fluidActive: state.fluidActive,
				revealAspect: cssWidth / cssHeight,
				revealDark,
				rippleStrength: waveConfig.strength,
				rippleWidth: waveConfig.width,
				waveOrigin: [waveConfig.originX / 100, waveConfig.originY / 100],
				waveSoftness: waveConfig.softness,
				waveLensWidth: waveConfig.lensWidth,
				waveLensFalloff: waveConfig.lensFalloff,
				waveLensChroma: waveConfig.lensChroma,
				waveLensShadow: waveConfig.lensShadow,
				waveBend: waveConfig.bend,
				waveReflection: waveConfig.reflection,
				waveCaustic: waveConfig.caustic,
				waveRings: waveConfig.rings,
				waveFrequency: waveConfig.frequency,
				waveDecay: waveConfig.decay,
				inFront: state.inFront,
				strength: settings.intensity,
				refraction: settings.refraction,
				dispersion: settings.dispersion,
				iridescence: settings.iridescence,
			});
		};

		// The display pass's inputs for this frame
		const displayState = (): DisplayState => {
			const intro = sceneIntros.get(host);
			return {
				introColour: intro?.colour ?? 0,
				waterReveal: intro?.waterReveal ?? 1,
				inFront: Number(!desktopLayout.matches || settings.inFront),
				fluidActive: Number(activeTime > 0),
			};
		};

		// The display pass's plain path: no wave, no fluid, portrait in front, full colour
		const plainDisplay = (state: DisplayState) =>
			state.waterReveal >= 1 && state.fluidActive === 0 && state.inFront === 1 && state.introColour <= 0;

		// NOTE • When the display pass would take its plain path (and no intro zoom) it only copies
		// `scene` to a canvas of the same size, texel for texel, and both are 8-bit. The composite
		// then draws straight to the canvas: the same values land in each pixel, and a full-screen
		// pass is saved every frame. The frame that reaches the plain path still runs the display
		// pass, so the wave's and the colour intro's final values are drawn (and written) as before.
		const displayIsCopy = (state: DisplayState, introZoom: number) =>
			!portraitOnly &&
			plainDisplay(state) &&
			displayed !== null &&
			plainDisplay(displayed) &&
			introZoom === 1 &&
			scene?.width === canvas.width &&
			scene?.height === canvas.height;

		// The layer's handle, driven frame by frame by the renderer
		return {
			resize,
			beginPortrait() {
				if (allocatedResolution !== settings.resolution) resize();
				sceneChanged = true;
				gl.bindFramebuffer(gl.FRAMEBUFFER, portrait.fbo);
				gl.viewport(0, 0, portrait.width, portrait.height);
			},

			// NOTE • A phone's layer has no marquee, label, text or fluid: once the colour intro
			// ends its frames only change when the portrait or a DOM texture does, or the
			// display pass's inputs move. Skipping the draw keeps the identical frame on screen.
			isStatic() {
				if (!mobile || portraitOnly || sceneChanged || !displayed || host.dataset.liquidReady !== 'true')
					return false;
				if (activeTime > 0 || queued.length || labelTransition) return false;
				// Only the display pass's plain path (wave done, no fluid, portrait in front) is skipped
				const state = displayState();
				return (
					state.waterReveal >= 1 &&
					state.inFront === 1 &&
					state.waterReveal === displayed.waterReveal &&
					state.introColour === displayed.introColour &&
					state.inFront === displayed.inFront &&
					state.fluidActive === displayed.fluidActive
				);
			},

			// Queues a pointer segment (current and previous position) for the next draw; keeps only the latest
			move(x, y) {
				if (mobile) return;
				const p: [number, number] = [x, 1 - y];
				if (previous) {
					queued.push([...p, ...previous]);
					if (queued.length > MAX_QUEUED_SEGMENTS) queued.shift();
				}
				previous = p;
			},
			resetPointer() {
				previous = null;
				queued = [];
			},

			// ANCHOR • Renders one frame
			draw(dt, scrollVelocity, gesture) {
				// A new scroll gesture changes the marquee phrase
				if (gesture !== labelGesture) {
					const from = labelTransition?.to ?? phraseFor(labelGesture);
					labelGesture = gesture;
					if (mobile || portraitOnly || matchMedia('(prefers-reduced-motion: reduce)').matches)
						uploadDecoration();
					else labelTransition = { from, to: phraseFor(gesture), elapsed: 0 };
				}
				stepLabelTransition(dt);
				refreshHeroText();
				advanceMarquee(dt, scrollVelocity);
				stepFluid(Math.min(dt, MAX_SIM_DT));

				const state = displayState();
				const introZoom = 1 + MOBILE_INTRO_ZOOM * mobileZoomRemaining(state.introColour);
				const blur = marqueeBlurAmount(scrollVelocity);
				if (displayIsCopy(state, introZoom)) drawScene(blur, state.inFront, null);
				else {
					if (!portraitOnly) drawScene(blur, state.inFront, scene);
					drawToScreen(state, introZoom);
				}
				displayed = state;
				sceneChanged = false;

				// Tells the site loader the first frame is ready
				if (host.dataset.liquidReady !== 'true') host.dataset.liquidReady = 'true';
			},
			destroy,
		};
	} catch (error) {
		destroy();
		throw error;
	}
}
