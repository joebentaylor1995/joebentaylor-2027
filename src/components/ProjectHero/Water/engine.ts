// Imports
// ------------
import { DESKTOP_HOVER_QUERY } from '@utils/desktopHover';
import { frameStep } from '@utils/frameClock';
import {
	decodeTextureImage,
	enableParallelCompile,
	setClampedLinear,
	type TextureImage,
	uploadTextureImage,
	waitForProgram,
} from '@utils/webgl';
import { gsap } from 'gsap';
import { drawHeroContent } from '../../Hero/Background/hero-content-texture';
import { createLiquidLayer, type LiquidLayer } from '../../Hero/Background/liquid';
import { liquidSettings } from '../../Hero/Background/liquid-settings';
import { liquidVertex } from '../../Hero/Background/liquid-shaders';
import { sceneIntros } from '../../Hero/Background/scene-intro';
import { HERO_SHADE_START } from '../framing';

// Constants
// ------------
// Composites the photo, its saturation and shade, and the baked title
const COMPOSITE_FRAGMENT = `
	precision highp float;
	varying vec2 uv;
	uniform sampler2D source, textSource;
	uniform vec2 cover, imageBox, introImage, shade;
	uniform float textOpacity, textOffset, saturation;
	void main() {
		// Cover-fit the photo, scaled around an anchor for the intro zoom
		vec2 imageUV = vec2(uv.x, 1. - ((1. - uv.y) - imageBox.x) / imageBox.y);
		vec2 anchor = vec2(.5, introImage.y);
		imageUV = (imageUV - anchor) / introImage.x + anchor;
		vec4 photo = texture2D(source, (imageUV - .5) * cover + .5);
		// Desaturate, then darken towards the bottom (shade.x = height scale, shade.y = opacity)
		float grey = dot(photo.rgb, vec3(.2126, .7152, .0722));
		photo.rgb = mix(vec3(grey), photo.rgb, saturation);
		photo.rgb *= 1. - clamp(((1. - uv.y) * shade.x - ${HERO_SHADE_START}) / ${1 - HERO_SHADE_START}, 0., 1.) * shade.y;
		// Overlay the baked title
		vec2 textUV = uv + vec2(0., textOffset);
		vec4 text = texture2D(textSource, textUV);
		text.a *= step(0., textUV.y) * step(textUV.y, 1.);
		gl_FragColor = vec4(mix(photo.rgb, text.rgb, text.a * textOpacity), 1.);
	}
`;

// Full-screen quad (two triangles)
const QUAD_VERTICES = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1];

// Longest step a frame may advance the water by
const MAX_FRAME_SECONDS = 0.025;

// Keep drawing a while after the pointer stops so the ripples can settle
const STIR_SETTLE_SECONDS = 13;

// Backing store limits
const MAX_PIXEL_RATIO = 2;
const MAX_PIXELS = 4000000;

// Media movement (px) too small to be worth a portrait redraw
const MEDIA_TOP_TOLERANCE = 0.01;

// Backing store a torn-down canvas keeps (it's hidden then; the next mount resizes it)
const RELEASED_CANVAS_SIZE = 1;

// Engine
// ------------
// The shared water pass receives a covered project image instead of the homepage's depth portrait.
//
// Each frame (while dirty) a small program composites the photo, a saturation/shade pass and the
// baked hero title into the liquid layer's portrait target, then the liquid layer ripples it.
// Returns destroy(); it also runs itself on context loss or if initialisation fails.
export function mountProjectWater(canvas: HTMLCanvasElement, photo: HTMLImageElement, host: HTMLElement) {
	// GL + shared handles
	const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
	if (!gl) return () => {};
	enableParallelCompile(gl);
	const bindProgram = gl.useProgram.bind(gl);
	const events = new AbortController();
	const media = photo.parentElement;
	if (!media) return () => {};
	const textRaster = document.createElement('canvas');

	// Lifecycle + GL resources, filled in by initialize()
	let disposed = false;
	let layer: LiquidLayer | undefined;
	let resizeObserver: ResizeObserver | undefined;
	let observer: IntersectionObserver | undefined;
	const gpu = {
		program: null as WebGLProgram | null,
		buffer: null as WebGLBuffer | null,
		texture: null as WebGLTexture | null,
		textTexture: null as WebGLTexture | null,
	};

	// Program inputs
	let position = 0;
	const uniforms = {
		cover: null as WebGLUniformLocation | null,
		source: null as WebGLUniformLocation | null,
		textSource: null as WebGLUniformLocation | null,
		textOpacity: null as WebGLUniformLocation | null,
		textOffset: null as WebGLUniformLocation | null,
		saturation: null as WebGLUniformLocation | null,
		imageBox: null as WebGLUniformLocation | null,
		introImage: null as WebGLUniformLocation | null,
		shade: null as WebGLUniformLocation | null,
	};

	// Render bookkeeping: frames are skipped unless something below changed (dirty) or the pointer is stirring the water
	let visible = true;
	let stirSecondsRemaining = 0;
	let dirty = true;

	// Measured on resize: where the shade sits, and the scroll offset the title raster was baked at
	let rasterOffset = 0;
	let shadeScale = 1;
	let shadeOpacity = 0;

	// The hero's live values, read each frame; drawn holds what the portrait last showed
	const live = { mediaTop: 0, imageScale: 1, textOpacity: 1, textOffset: 0, saturation: 1 };
	const drawn = { mediaTop: Number.NaN, imageScale: 1, textOpacity: 1, textOffset: 0, saturation: 1 };

	const profileScene = host.closest<HTMLElement>('[data-profile-scene]');
	const isScenePaused = () => profileScene?.dataset.scenePaused === 'true';
	const syncTicker = () => {
		gsap.ticker.remove(draw);
		if (!disposed && layer && visible && !document.hidden && !isScenePaused()) {
			dirty = true;
			gsap.ticker.add(draw);
		}
	};

	// Re-sync whenever the surrounding scene flips data-scene-paused
	const pauseObserver = new MutationObserver(syncTicker);
	// Intro state shared with the scene intro sequencer (registered in sceneIntros)
	const entrance = { portrait: 1, marqueeBoost: 0, waterReveal: 1, colour: 0 };
	let previousReveal = Number.NaN;
	const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
	// NOTE • Only desktop bakes the title into the water. Phones and touch tablets run no fluid, and
	// their title scrolls natively over the held image, so the DOM text stays visible above the canvas.
	// Water remounts when the breakpoint changes, so this is read once.
	const bakeText = matchMedia(DESKTOP_HOVER_QUERY).matches;

	// Reads the scroll/intro-driven values the hero writes as CSS custom properties, and flags any change
	const readLiveValues = (mediaTop: number) => {
		live.mediaTop = mediaTop;
		live.imageScale = Number(host.style.getPropertyValue('--project-intro-scale') || 1);
		live.textOpacity = Number(host.style.getPropertyValue('--project-text-opacity') || 1);
		live.textOffset = Number(host.style.getPropertyValue('--project-copy-offset') || 0) - rasterOffset;
		live.saturation = Number(host.style.getPropertyValue('--project-image-saturation') || 1);

		if (live.textOffset !== drawn.textOffset) dirty = true;
		if (live.textOpacity !== drawn.textOpacity) dirty = true;
		if (live.saturation !== drawn.saturation) dirty = true;
		if (live.imageScale !== drawn.imageScale) dirty = true;
		if (Math.abs(mediaTop - drawn.mediaTop) > MEDIA_TOP_TOLERANCE || Number.isNaN(drawn.mediaTop)) dirty = true;
	};

	// Composites the photo, shade and title into the liquid layer's portrait target
	const drawPortrait = (activeLayer: LiquidLayer, mediaBounds: DOMRect, bounds: DOMRect) => {
		activeLayer.beginPortrait();
		bindProgram(gpu.program);
		gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
		gl.enableVertexAttribArray(position);
		gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
		gl.activeTexture(gl.TEXTURE0);
		gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
		// Photo, cover-fitted to the media box
		gl.uniform1i(uniforms.source, 0);
		const aspect = mediaBounds.width / mediaBounds.height;
		const imageAspect = photo.naturalWidth / photo.naturalHeight;
		gl.uniform2f(uniforms.cover, Math.min(1, aspect / imageAspect), Math.min(1, imageAspect / aspect));
		gl.uniform2f(uniforms.imageBox, live.mediaTop / bounds.height, mediaBounds.height / bounds.height);
		gl.uniform2f(uniforms.introImage, live.imageScale, 1 - (window.innerHeight * 0.5) / mediaBounds.height);

		// Baked title, then colour/shade adjustments
		gl.activeTexture(gl.TEXTURE1);
		gl.bindTexture(gl.TEXTURE_2D, gpu.textTexture);
		gl.uniform1i(uniforms.textSource, 1);
		gl.uniform1f(uniforms.textOpacity, bakeText ? live.textOpacity : 0);
		gl.uniform1f(uniforms.textOffset, live.textOffset / bounds.height);
		gl.uniform1f(uniforms.saturation, live.saturation);
		gl.uniform2f(uniforms.shade, shadeScale, shadeOpacity);
		gl.drawArrays(gl.TRIANGLES, 0, 6);

		drawn.mediaTop = live.mediaTop;
		drawn.imageScale = live.imageScale;
		drawn.textOpacity = live.textOpacity;
		drawn.textOffset = live.textOffset;
		drawn.saturation = live.saturation;
		dirty = false;
	};

	// Frame: read the hero's CSS-driven values, redraw the portrait only if one changed, then advance the water
	const draw = (_time: number, delta: number) => {
		if (!layer || disposed || !visible || document.hidden || isScenePaused()) return;
		if (!canvas.clientWidth || !canvas.clientHeight || gl.isContextLost()) return;

		const mediaBounds = media.getBoundingClientRect();
		const bounds = canvas.getBoundingClientRect();
		readLiveValues(mediaBounds.top - bounds.top);

		if (!dirty && stirSecondsRemaining <= 0 && entrance.waterReveal === 1 && previousReveal === 1) return;

		// NOTE • The vsync step (see src/utils/frameClock.ts), so the ripples advance evenly;
		// GSAP's own delta is whole milliseconds. Falls back to it on a run's first frame.
		const dt = Math.min((frameStep() || delta) / 1000, MAX_FRAME_SECONDS);

		if (dirty) drawPortrait(layer, mediaBounds, bounds);

		layer.draw(dt, 0, 0);
		previousReveal = entrance.waterReveal;
		stirSecondsRemaining -= dt;
		// NOTE • Written only when they change: each write is an attribute mutation that
		// observers and style invalidation would otherwise see on every drawn frame
		const intro = entrance.waterReveal === 1 ? 'complete' : 'playing';
		if (canvas.dataset.ready !== 'true') canvas.dataset.ready = 'true';
		if (bakeText && host.dataset.waterText !== 'true') host.dataset.waterText = 'true';
		if (canvas.dataset.intro !== intro) canvas.dataset.intro = intro;
	};

	// Idempotent teardown of observers, listeners and GL resources, restoring the plain hero
	const destroy = () => {
		if (disposed) return;
		disposed = true;
		events.abort();
		gsap.ticker.remove(draw);
		resizeObserver?.disconnect();
		observer?.disconnect();
		pauseObserver.disconnect();
		layer?.destroy();
		gl.deleteTexture(gpu.texture);
		gl.deleteTexture(gpu.textTexture);
		gl.deleteBuffer(gpu.buffer);
		gl.deleteProgram(gpu.program);
		sceneIntros.delete(host);
		delete host.dataset.liquidReady;
		delete host.dataset.waterText;
		delete canvas.dataset.ready;
		delete canvas.dataset.intro;
		// NOTE • Case studies stay mounted (hidden) under React Activity, and a canvas keeps its
		// full drawing buffer (up to 4M px) while it does. Without data-ready the canvas is at
		// opacity 0, so dropping the buffer changes nothing on screen; the next mount resizes it.
		canvas.width = RELEASED_CANVAS_SIZE;
		canvas.height = RELEASED_CANVAS_SIZE;
	};

	// Re-bakes the title raster into its texture
	const bakeTitle = (textTexture: WebGLTexture, maxTextureSize: number) => {
		// Keep the texture opaque on resize; the shader applies the live scroll fade.
		const opacity = host.style.getPropertyValue('--project-text-opacity');
		host.style.setProperty('--project-text-opacity', '1');
		try {
			drawHeroContent(canvas, host, maxTextureSize, textRaster, host);
			rasterOffset = Number(host.style.getPropertyValue('--project-copy-offset') || 0);
		} finally {
			if (opacity) host.style.setProperty('--project-text-opacity', opacity);
			else host.style.removeProperty('--project-text-opacity');
		}
		gl.bindTexture(gl.TEXTURE_2D, textTexture);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textRaster);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	};

	// Resize the backing store (capped by texture size and a pixel budget) and re-bake the title raster
	const resize = () => {
		if (disposed || gl.isContextLost() || !canvas.clientWidth || !canvas.clientHeight) return;
		const width = Math.max(1, canvas.clientWidth),
			height = Math.max(1, canvas.clientHeight);
		// The title's minimum height resolves 100svh, including mobile browser chrome.
		const title = host.querySelector<HTMLElement>('[data-project-hero-copy]');
		const viewportHeight = title ? Number.parseFloat(getComputedStyle(title).minHeight) : height;
		shadeScale = height / (viewportHeight || height);
		shadeOpacity = Number.parseFloat(getComputedStyle(host, '::after').opacity);

		const max = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
		const ratio = Math.min(
			devicePixelRatio,
			MAX_PIXEL_RATIO,
			max / Math.max(width, height),
			Math.sqrt(MAX_PIXELS / (width * height))
		);

		// NOTE • Fonts, the title reveal and both observed boxes all land here, mostly at an
		// unchanged size. Assigning a canvas dimension, even to its current value, is how a
		// drawing buffer gets reallocated, so it is only done when the size really changes.
		const pixelWidth = Math.round(width * ratio),
			pixelHeight = Math.round(height * ratio);
		if (canvas.width !== pixelWidth) canvas.width = pixelWidth;
		if (canvas.height !== pixelHeight) canvas.height = pixelHeight;
		try {
			layer?.resize();
		} catch {
			// ResizeObserver runs outside initialization's rejection handler. If the
			// GPU cannot allocate targets, restore the native hero instead of crashing.
			destroy();
			return;
		}

		if (gpu.textTexture && bakeText) bakeTitle(gpu.textTexture, max);

		dirty = true;
	};

	const compileCompositeProgram = () => {
		const program = gl.createProgram();
		gpu.program = program;
		if (!program) throw new Error('Project water program unavailable');
		for (const [type, code] of [
			[gl.VERTEX_SHADER, liquidVertex],
			[gl.FRAGMENT_SHADER, COMPOSITE_FRAGMENT],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Project water shader unavailable');
			gl.shaderSource(shader, code);
			gl.compileShader(shader);
			gl.attachShader(program, shader);
			gl.deleteShader(shader);
		}
		gl.linkProgram(program);
		return program;
	};

	// A cold shader cache compiles for ~200ms; reading LINK_STATUS straight
	// away would block the page through the visitor's first scroll.
	// Resolves false if the mount went away while waiting.
	const waitForLink = async (program: WebGLProgram) => {
		if (!(await waitForProgram(gl, program, () => disposed))) return false;
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Project water shader failed');
		return true;
	};

	const lookupProgramInputs = (program: WebGLProgram) => {
		position = gl.getAttribLocation(program, 'position');
		uniforms.cover = gl.getUniformLocation(program, 'cover');
		uniforms.source = gl.getUniformLocation(program, 'source');
		uniforms.textSource = gl.getUniformLocation(program, 'textSource');
		uniforms.textOpacity = gl.getUniformLocation(program, 'textOpacity');
		uniforms.textOffset = gl.getUniformLocation(program, 'textOffset');
		uniforms.saturation = gl.getUniformLocation(program, 'saturation');
		uniforms.imageBox = gl.getUniformLocation(program, 'imageBox');
		uniforms.introImage = gl.getUniformLocation(program, 'introImage');
		uniforms.shade = gl.getUniformLocation(program, 'shade');
	};

	// Quad buffer, the photo texture, and the title texture (its pixels are uploaded by resize()).
	// The photo arrives already decoded and flipped (see initialize()).
	const createGeometryAndTextures = (photoImage: TextureImage) => {
		gpu.buffer = gl.createBuffer();
		gpu.texture = gl.createTexture();
		if (!gpu.buffer || !gpu.texture) throw new Error('Project water resources unavailable');
		gl.bindBuffer(gl.ARRAY_BUFFER, gpu.buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(QUAD_VERTICES), gl.STATIC_DRAW);
		gl.bindTexture(gl.TEXTURE_2D, gpu.texture);
		setClampedLinear(gl);
		uploadTextureImage(gl, photoImage, true);

		gpu.textTexture = gl.createTexture();
		if (!gpu.textTexture) throw new Error('Project text texture unavailable');
		gl.bindTexture(gl.TEXTURE_2D, gpu.textTexture);
		setClampedLinear(gl);
	};

	// Pointer stirs the water only on fine pointers, inside the canvas, over the hero or header
	const stirWater = (event: PointerEvent) => {
		if (!finePointer.matches || event.pointerType === 'touch' || isScenePaused()) return;
		const target = event.target instanceof Element ? event.target : null;
		// NOTE • The cheap checks come first: this runs for every move anywhere on the page, and
		// measuring the canvas forces a layout. They end the same way as the bounds check below.
		if (!visible || !target || (!host.contains(target) && !target.closest('header'))) {
			layer?.resetPointer();
			return;
		}
		const rect = canvas.getBoundingClientRect();
		if (
			event.clientX < rect.left ||
			event.clientX > rect.right ||
			event.clientY < rect.top ||
			event.clientY > rect.bottom
		) {
			layer?.resetPointer();
			return;
		}
		layer?.move((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
		stirSecondsRemaining = STIR_SETTLE_SECONDS;
	};

	// Starts observers and listeners once the liquid layer exists
	const attachObservers = () => {
		const { signal } = events;
		sceneIntros.set(host, entrance);
		resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas);
		resizeObserver.observe(media);
		document.fonts.addEventListener('loadingdone', resize, { signal });
		host.addEventListener('page-title:revealed', resize, { signal });

		observer = new IntersectionObserver(entries => {
			visible = entries[0].isIntersecting;
			syncTicker();
		});
		observer.observe(host);
		if (profileScene)
			pauseObserver.observe(profileScene, { attributes: true, attributeFilter: ['data-scene-paused'] });
		document.addEventListener('visibilitychange', syncTicker, { signal });

		window.addEventListener('pointermove', stirWater, { signal });

		host.addEventListener('pointerleave', () => layer?.resetPointer(), { signal });
		syncTicker();
	};

	// Async setup: decode the photo, build the compositing program, create textures, then the liquid layer
	const initialize = async () => {
		await photo.decode();
		if (disposed) return;
		// NOTE • Why: texImage2D(<img>) re-decodes and flips the full-width hero photo on the main
		// thread (~70ms at 4K) as the case study opens. This decodes the same file, already
		// flipped, off the main thread, starting now so it overlaps the fonts and the link.
		const photoImage = decodeTextureImage(photo, true);
		try {
			await document.fonts.ready;
			if (disposed) return;

			const program = compileCompositeProgram();
			if (!(await waitForLink(program))) return;
			lookupProgramInputs(program);
			const image = await photoImage;
			if (disposed) return;
			createGeometryAndTextures(image);
		} finally {
			// Uploaded (or no longer wanted): the decoded copy can go
			void photoImage.then(
				image => {
					if (image instanceof ImageBitmap) image.close();
				},
				() => {}
			);
		}

		resize();
		layer = await createLiquidLayer(
			gl,
			canvas,
			host,
			{ ...liquidSettings },
			() => disposed,
			true,
			DESKTOP_HOVER_QUERY
		);
		if (disposed) {
			layer.destroy();
			return;
		}

		attachObservers();
	};

	canvas.addEventListener('webglcontextlost', destroy, { signal: events.signal });
	void initialize().catch(destroy);
	return destroy;
}
