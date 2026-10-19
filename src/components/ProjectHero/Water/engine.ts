import { mq } from '@tackl';
import { gsap } from 'gsap';
import { drawHeroContent } from '../../Hero/Background/hero-content-texture';
import { createLiquidLayer, type LiquidLayer } from '../../Hero/Background/liquid';
import { liquidSettings } from '../../Hero/Background/liquid-settings';
import { liquidVertex } from '../../Hero/Background/liquid-shaders';
import { sceneIntros } from '../../Hero/Background/scene-intro';

// The shared water pass receives a covered project image instead of the homepage's depth portrait.
export function mountProjectWater(canvas: HTMLCanvasElement, photo: HTMLImageElement, host: HTMLElement) {
	const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
	if (!gl) return () => {};
	const bindProgram = gl.useProgram.bind(gl);
	const events = new AbortController();
	const media = photo.parentElement;
	if (!media) return () => {};
	const textRaster = document.createElement('canvas');
	let disposed = false;
	let layer: LiquidLayer | undefined;
	let program: WebGLProgram | null = null;
	let buffer: WebGLBuffer | null = null;
	let texture: WebGLTexture | null = null;
	let textTexture: WebGLTexture | null = null;
	let resizeObserver: ResizeObserver | undefined;
	let observer: IntersectionObserver | undefined;
	let visible = true;
	let framesRemaining = 0;
	let dirty = true;
	let position = 0;
	let cover: WebGLUniformLocation | null = null;
	let source: WebGLUniformLocation | null = null;
	let textSource: WebGLUniformLocation | null = null;
	let textOpacity: WebGLUniformLocation | null = null;
	let textOffset: WebGLUniformLocation | null = null;
	let rasterOffset = 0;
	let previousTextOffset = 0;
	let previousTextOpacity = 1;
	let saturation: WebGLUniformLocation | null = null;
	let previousSaturation = 1;
	let imageBox: WebGLUniformLocation | null = null;
	let introImage: WebGLUniformLocation | null = null;
	let shade: WebGLUniformLocation | null = null;
	let shadeScale = 1;
	let shadeOpacity = 0;
	let previousImageScale = 1;
	let previousMediaTop = Number.NaN;
	const profileScene = host.closest<HTMLElement>('[data-profile-scene]');
	const syncTicker = () => {
		gsap.ticker.remove(draw);
		if (!disposed && layer && visible && !document.hidden && profileScene?.dataset.scenePaused !== 'true') {
			dirty = true;
			gsap.ticker.add(draw);
		}
	};
	const pauseObserver = new MutationObserver(syncTicker);
	const entrance = { portrait: 1, marqueeBoost: 0, waterReveal: 1, colour: 0 };
	let previousReveal = Number.NaN;
	const finePointer = matchMedia('(hover: hover) and (pointer: fine)');
	const draw = (_time: number, delta: number) => {
		if (!layer || disposed || !visible || document.hidden || profileScene?.dataset.scenePaused === 'true') return;
		if (!canvas.clientWidth || !canvas.clientHeight || gl.isContextLost()) return;
		const mediaBounds = media.getBoundingClientRect();
		const bounds = canvas.getBoundingClientRect();
		const mediaTop = mediaBounds.top - bounds.top;
		const imageScale = Number(host.style.getPropertyValue('--project-intro-scale') || 1);
		const textAlpha = Number(host.style.getPropertyValue('--project-text-opacity') || 1);
		const copyOffset = Number(host.style.getPropertyValue('--project-copy-offset') || 0) - rasterOffset;
		if (copyOffset !== previousTextOffset) dirty = true;
		if (textAlpha !== previousTextOpacity) dirty = true;
		const imageSaturation = Number(host.style.getPropertyValue('--project-image-saturation') || 1);
		if (imageSaturation !== previousSaturation) dirty = true;
		if (imageScale !== previousImageScale) dirty = true;
		if (Math.abs(mediaTop - previousMediaTop) > 0.01 || Number.isNaN(previousMediaTop)) dirty = true;
		if (!dirty && framesRemaining <= 0 && entrance.waterReveal === 1 && previousReveal === 1) return;
		const dt = Math.min(delta / 1000, 0.025);
		if (dirty) {
			layer.beginPortrait();
			bindProgram(program);
			gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
			gl.enableVertexAttribArray(position);
			gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
			gl.activeTexture(gl.TEXTURE0);
			gl.bindTexture(gl.TEXTURE_2D, texture);
			gl.uniform1i(source, 0);
			const aspect = mediaBounds.width / mediaBounds.height;
			const imageAspect = photo.naturalWidth / photo.naturalHeight;
			gl.uniform2f(cover, Math.min(1, aspect / imageAspect), Math.min(1, imageAspect / aspect));
			gl.uniform2f(imageBox, mediaTop / bounds.height, mediaBounds.height / bounds.height);
			gl.uniform2f(introImage, imageScale, 1 - (window.innerHeight * 0.5) / mediaBounds.height);
			gl.activeTexture(gl.TEXTURE1);
			gl.bindTexture(gl.TEXTURE_2D, textTexture);
			gl.uniform1i(textSource, 1);
			gl.uniform1f(textOpacity, textAlpha);
			gl.uniform1f(textOffset, copyOffset / bounds.height);
			gl.uniform1f(saturation, imageSaturation);
			gl.uniform2f(shade, shadeScale, shadeOpacity);
			gl.drawArrays(gl.TRIANGLES, 0, 6);
			previousMediaTop = mediaTop;
			previousImageScale = imageScale;
			previousTextOpacity = textAlpha;
			previousTextOffset = copyOffset;
			previousSaturation = imageSaturation;
			dirty = false;
		}
		layer.draw(dt, 0, 0);
		previousReveal = entrance.waterReveal;
		framesRemaining -= dt;
		canvas.dataset.ready = 'true';
		host.dataset.waterText = 'true';
		canvas.dataset.intro = entrance.waterReveal === 1 ? 'complete' : 'playing';
	};
	const destroy = () => {
		if (disposed) return;
		disposed = true;
		events.abort();
		gsap.ticker.remove(draw);
		resizeObserver?.disconnect();
		observer?.disconnect();
		pauseObserver.disconnect();
		layer?.destroy();
		gl.deleteTexture(texture);
		gl.deleteTexture(textTexture);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
		sceneIntros.delete(host);
		delete host.dataset.liquidReady;
		delete host.dataset.waterText;
		delete canvas.dataset.ready;
		delete canvas.dataset.intro;
	};
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
			2,
			max / Math.max(width, height),
			Math.sqrt(4000000 / (width * height))
		);
		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);
		try {
			layer?.resize();
		} catch {
			// ResizeObserver runs outside initialization's rejection handler. If the
			// GPU cannot allocate targets, restore the native hero instead of crashing.
			destroy();
			return;
		}
		if (textTexture) {
			// Keep the texture opaque on resize; the shader applies the live scroll fade.
			const opacity = host.style.getPropertyValue('--project-text-opacity');
			host.style.setProperty('--project-text-opacity', '1');
			try {
				drawHeroContent(canvas, host, max, textRaster, host);
				rasterOffset = Number(host.style.getPropertyValue('--project-copy-offset') || 0);
			} finally {
				if (opacity) host.style.setProperty('--project-text-opacity', opacity);
				else host.style.removeProperty('--project-text-opacity');
			}
			gl.bindTexture(gl.TEXTURE_2D, textTexture);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textRaster);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		}
		dirty = true;
	};
	const initialize = async () => {
		await photo.decode();
		await document.fonts.ready;
		if (disposed) return;
		program = gl.createProgram();
		if (!program) throw new Error('Project water program unavailable');
		for (const [type, code] of [
			[gl.VERTEX_SHADER, liquidVertex],
			[
				gl.FRAGMENT_SHADER,
				`precision highp float; varying vec2 uv; uniform sampler2D source,textSource; uniform vec2 cover,imageBox,introImage,shade; uniform float textOpacity,textOffset,saturation;
				void main(){
				vec2 imageUV=vec2(uv.x,1.-((1.-uv.y)-imageBox.x)/imageBox.y);
				vec2 anchor=vec2(.5,introImage.y);
				imageUV=(imageUV-anchor)/introImage.x+anchor;
				vec4 photo=texture2D(source,(imageUV-.5)*cover+.5);
				float grey=dot(photo.rgb,vec3(.2126,.7152,.0722));
				photo.rgb=mix(vec3(grey),photo.rgb,saturation);
				photo.rgb*=1.-clamp((1.-uv.y)*shade.x,0.,1.)*shade.y;
				vec2 textUV=uv+vec2(0.,textOffset);
				vec4 text=texture2D(textSource,textUV);
				text.a*=step(0.,textUV.y)*step(textUV.y,1.);
				gl_FragColor=vec4(mix(photo.rgb,text.rgb,text.a*textOpacity),1.);
				}`,
			],
		] as const) {
			const shader = gl.createShader(type);
			if (!shader) throw new Error('Project water shader unavailable');
			gl.shaderSource(shader, code);
			gl.compileShader(shader);
			gl.attachShader(program, shader);
			gl.deleteShader(shader);
		}
		gl.linkProgram(program);
		if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Project water shader failed');
		position = gl.getAttribLocation(program, 'position');
		cover = gl.getUniformLocation(program, 'cover');
		source = gl.getUniformLocation(program, 'source');
		textSource = gl.getUniformLocation(program, 'textSource');
		textOpacity = gl.getUniformLocation(program, 'textOpacity');
		textOffset = gl.getUniformLocation(program, 'textOffset');
		saturation = gl.getUniformLocation(program, 'saturation');
		imageBox = gl.getUniformLocation(program, 'imageBox');
		introImage = gl.getUniformLocation(program, 'introImage');
		shade = gl.getUniformLocation(program, 'shade');
		buffer = gl.createBuffer();
		texture = gl.createTexture();
		if (!buffer || !texture) throw new Error('Project water resources unavailable');
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, photo);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		textTexture = gl.createTexture();
		if (!textTexture) throw new Error('Project text texture unavailable');
		gl.bindTexture(gl.TEXTURE_2D, textTexture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		resize();
		layer = await createLiquidLayer(gl, canvas, host, { ...liquidSettings }, () => disposed, true, mq.up.l);
		if (disposed) {
			layer.destroy();
			return;
		}
		sceneIntros.set(host, entrance);
		resizeObserver = new ResizeObserver(resize);
		resizeObserver.observe(canvas);
		resizeObserver.observe(media);
		document.fonts.addEventListener('loadingdone', resize, { signal: events.signal });
		host.addEventListener('page-title:revealed', resize, { signal: events.signal });
		observer = new IntersectionObserver(entries => {
			visible = entries[0].isIntersecting;
			syncTicker();
		});
		observer.observe(host);
		if (profileScene)
			pauseObserver.observe(profileScene, { attributes: true, attributeFilter: ['data-scene-paused'] });
		document.addEventListener('visibilitychange', syncTicker, { signal: events.signal });
		window.addEventListener(
			'pointermove',
			event => {
				if (
					!finePointer.matches ||
					event.pointerType === 'touch' ||
					profileScene?.dataset.scenePaused === 'true'
				)
					return;
				const rect = canvas.getBoundingClientRect();
				const target = event.target instanceof Element ? event.target : null;
				if (
					!visible ||
					!target ||
					(!host.contains(target) && !target.closest('header')) ||
					event.clientX < rect.left ||
					event.clientX > rect.right ||
					event.clientY < rect.top ||
					event.clientY > rect.bottom
				) {
					layer?.resetPointer();
					return;
				}
				layer?.move((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
				framesRemaining = 13;
			},
			{ signal: events.signal }
		);
		host.addEventListener('pointerleave', () => layer?.resetPointer(), { signal: events.signal });
		syncTicker();
	};
	canvas.addEventListener('webglcontextlost', destroy, { signal: events.signal });
	void initialize().catch(destroy);
	return destroy;
}
