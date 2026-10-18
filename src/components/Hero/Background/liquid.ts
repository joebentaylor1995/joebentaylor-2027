// Imports
// ------------

import { MOBILE_COLOUR_DURATION, MOBILE_SCALE_DURATION, MOBILE_SCALE_EASE } from '@parts/SiteLoader/mobile-intro';
import { gsap } from 'gsap';
import { HERO_DESKTOP_QUERY } from '../layout';
import { drawHeroContent } from './hero-content-texture';
import type { LiquidSettings } from './liquid-settings';
import * as shaders from './liquid-shaders';
import { drawMarqueeDecoration, marqueePhrases } from './marquee-decoration';
import { introDefaults, introSettings, sceneIntros } from './scene-intro';

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
	move: (x: number, y: number) => void;
	resetPointer: () => void;
	destroy: () => void;
}

// Renderer
// ------------
export async function createLiquidLayer(
	gl: WebGLRenderingContext,
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	settings: LiquidSettings,
	isCancelled = () => false,
	portraitOnly = false,
	desktopQuery = HERO_DESKTOP_QUERY
): Promise<LiquidLayer> {
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
	const textures = new Set<WebGLTexture>();
	const targets = new Set<Target>();
	const programs: WebGLProgram[] = [];
	const buffer = gl.createBuffer();
	if (!buffer) throw new Error('Unable to allocate liquid quad');
	let previous: [number, number] | null = null;
	let queued: [number, number, number, number][] = [];
	let activeTime = 0;
	let phase = 0;
	let direction = 1;
	let phaseInitialized = false;
	let stripWidth = 1,
		stripHeight = 1,
		bottom = 0,
		duration = 48;
	let cssWidth = canvas.clientWidth,
		cssHeight = canvas.clientHeight;
	let background = [0, 0, 0];
	let revealDark = [0, 0, 0];
	let portrait: Target,
		scene: Target,
		velocity: ReturnType<typeof pair>,
		height: ReturnType<typeof pair>,
		pressure: ReturnType<typeof pair>,
		divergence: Target,
		curl: Target;
	let simWidth = 1,
		simHeight = 1;
	const maxTexture = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number;
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

	function destroy() {
		for (const target of targets) gl.deleteFramebuffer(target.fbo);
		for (const texture of textures) gl.deleteTexture(texture);
		for (const program of programs) gl.deleteProgram(program);
		gl.deleteBuffer(buffer);
		targets.clear();
		textures.clear();
	}
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
			await new Promise(resolve => setTimeout(resolve, 16));
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
	function pair() {
		return {
			read: target(simWidth, simHeight, gl.FLOAT),
			write: target(simWidth, simHeight, gl.FLOAT),
			swap() {
				[this.read, this.write] = [this.write, this.read];
			},
		};
	}
	function draw(p: Program, dest: Target | null, values: Record<string, Value>) {
		bindProgram(p.program);
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.enableVertexAttribArray(p.position);
		gl.vertexAttribPointer(p.position, 2, gl.FLOAT, false, 0, 0);
		gl.bindFramebuffer(gl.FRAMEBUFFER, dest?.fbo ?? null);
		gl.viewport(0, 0, dest?.width ?? canvas.width, dest?.height ?? canvas.height);
		let unit = 0;
		const uniforms: Record<string, Value> = { px: [1 / simWidth, 1 / simHeight], ...values };
		for (const [key, value] of Object.entries(uniforms)) {
			const location = p.uniforms[key];
			if (!location) continue;
			if (typeof value === 'number') gl.uniform1f(location, value);
			else if (Array.isArray(value)) {
				if (value.length === 2) gl.uniform2fv(location, value);
				else if (value.length === 4) gl.uniform4fv(location, value);
				else gl.uniform3fv(location, value);
			} else {
				gl.activeTexture(gl.TEXTURE0 + unit);
				gl.bindTexture(gl.TEXTURE_2D, value.texture);
				gl.uniform1i(location, unit++);
			}
		}
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	}

	try {
		gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
		gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
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
		const activeNames = names.filter(name => !mobile || name === 'composite' || name === 'display');
		const sources = {
			advect: shaders.advect,
			splat: shaders.splat,
			curl: shaders.curl,
			vorticity: shaders.vorticity,
			divergence: shaders.divergence,
			pressure: shaders.pressure,
			gradient: shaders.gradient,
			composite: portraitOnly
				? 'void main(){gl_FragColor=texture2D(source,uv);}'
				: mobile
					? shaders.mobileComposite
					: shaders.composite,
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
		const logos = { texture: texture() };
		const decoration = { texture: texture() };
		let labelGesture = 0;
		const uploadDecoration = () => {
			if (mobile || portraitOnly) return;
			gl.bindTexture(gl.TEXTURE_2D, decoration.texture);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			try {
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					drawMarqueeDecoration(
						canvas,
						host,
						maxTexture,
						marqueePhrases[labelGesture % marqueePhrases.length]
					)
				);
			} finally {
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			}
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
		function resize() {
			cssWidth = canvas.clientWidth;
			cssHeight = canvas.clientHeight;
			const scale = Math.min(
				settings.resolution / Math.min(cssWidth, cssHeight),
				768 / Math.max(cssWidth, cssHeight)
			);
			const nextSimWidth = Math.max(1, Math.round(cssWidth * scale));
			const nextSimHeight = Math.max(1, Math.round(cssHeight * scale));
			// Text, font and entrance refreshes share this path with viewport resizes.
			// Keep the live water state unless the render targets actually need a new size.
			if (
				allocatedWidth !== canvas.width ||
				allocatedHeight !== canvas.height ||
				simWidth !== nextSimWidth ||
				simHeight !== nextSimHeight
			) {
				for (const t of targets) {
					gl.deleteFramebuffer(t.fbo);
					gl.deleteTexture(t.texture);
					textures.delete(t.texture);
				}
				targets.clear();
				allocatedWidth = canvas.width;
				allocatedHeight = canvas.height;
				simWidth = nextSimWidth;
				simHeight = nextSimHeight;
				portrait = target(canvas.width, canvas.height, gl.UNSIGNED_BYTE);
				scene = target(canvas.width, canvas.height, gl.UNSIGNED_BYTE);
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
				previous = null;
				queued = [];
				activeTime = 0;
			}
			allocatedResolution = settings.resolution;
			// Rasterise only on layout/content changes. Every animation frame scrolls this texture on the GPU.
			if (!mobile && track && !portraitOnly) {
				const bounds = track.getBoundingClientRect(),
					hostBounds = canvas.getBoundingClientRect();
				const style = getComputedStyle(track);
				stripWidth = bounds.width + (parseFloat(style.columnGap) || 0);
				stripHeight = Math.max(1, bounds.height);
				bottom = hostBounds.bottom - bounds.bottom;
				duration = parseFloat(style.animationDuration) || 48;
				if (!phaseInitialized) {
					const animation = track.getAnimations()[0];
					phase = typeof animation?.currentTime === 'number' ? animation.currentTime / 1000 / duration : 0;
					phaseInitialized = true;
				}
				const raster = document.createElement('canvas');
				const ratio = Math.min(2, maxTexture / Math.max(stripWidth, stripHeight));
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
				gl.bindTexture(gl.TEXTURE_2D, logos.texture);
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
				try {
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, raster);
				} finally {
					gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
				}
				uploadDecoration();
			}
			gl.bindTexture(gl.TEXTURE_2D, content.texture);
			gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
			try {
				gl.texImage2D(
					gl.TEXTURE_2D,
					0,
					gl.RGBA,
					gl.RGBA,
					gl.UNSIGNED_BYTE,
					desktopLayout.matches && !portraitOnly ? drawHeroContent(canvas, host, maxTexture) : textRaster
				);
			} finally {
				gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
			}
			// Resolve token colours through the browser, including modern CSS colour syntax.
			background = resolveColour(getComputedStyle(host).backgroundColor);
			const cover = host.querySelector<HTMLElement>('[data-scene-cover]');
			revealDark = portraitOnly
				? background
				: resolveColour(cover ? getComputedStyle(cover).backgroundColor : getComputedStyle(host).color);
			textFrame = textElement?.dataset.textFrame;
		}
		resize();
		return {
			resize,
			beginPortrait() {
				if (allocatedResolution !== settings.resolution) resize();
				gl.bindFramebuffer(gl.FRAMEBUFFER, portrait.fbo);
				gl.viewport(0, 0, portrait.width, portrait.height);
			},
			move(x, y) {
				if (mobile) return;
				const p: [number, number] = [x, 1 - y];
				if (previous) {
					queued.push([...p, ...previous]);
					if (queued.length > 24) queued.shift();
				}
				previous = p;
			},
			resetPointer() {
				previous = null;
				queued = [];
			},
			draw(dt, scrollVelocity, gesture) {
				if (gesture !== labelGesture) {
					labelGesture = gesture;
					uploadDecoration();
				}
				if (!portraitOnly && desktopLayout.matches && textFrame !== textElement?.dataset.textFrame) {
					textFrame = textElement?.dataset.textFrame;
					gl.bindTexture(gl.TEXTURE_2D, content.texture);
					gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
					try {
						gl.texImage2D(
							gl.TEXTURE_2D,
							0,
							gl.RGBA,
							gl.RGBA,
							gl.UNSIGNED_BYTE,
							drawHeroContent(canvas, host, maxTexture, textRaster)
						);
					} finally {
						gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
					}
				}
				// Keep gentle scrolling sharp; ramp blur gradually above moderate velocity.
				const blurAmount =
					Math.min(
						1,
						Math.max(
							0,
							(Math.abs(scrollVelocity) - settings.marqueeBlurThreshold) /
								(1 - settings.marqueeBlurThreshold)
						)
					) ** settings.marqueeBlurCurve;
				if (!settings.marqueeReverse) direction = 1;
				else if (Math.abs(scrollVelocity) > 0.005) direction = Math.sign(scrollVelocity);
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
				dt = Math.min(dt, 0.025);
				if (queued.length) activeTime = 12;
				if (activeTime > 0) {
					activeTime -= dt;
					for (const [x, y, ox, oy] of queued.splice(0)) {
						const distance = Math.hypot((x - ox) * cssWidth, (y - oy) * cssHeight);
						if (distance < 0.2) continue;
						const common = {
							point: [x, y],
							previous: [ox, oy],
							aspect: [cssWidth / cssHeight, 1],
							radius: ((settings.size * 0.65 + 12) / cssHeight) ** 2,
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
							amount: [Math.min(0.4, 0.1 + distance * 0.004) * settings.density, 0, 0],
						});
						height.swap();
					}
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
						decay: Math.exp(-dt * (2.4 - settings.persistence * 0.02)),
					});
					height.swap();
				}
				draw(passes.composite, scene, {
					source: portrait,
					inFront: Number(!desktopLayout.matches || settings.inFront),
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
				const introColour = sceneIntros.get(host)?.colour ?? 0;
				// Recover elapsed progress from the colour's sine easing once per frame.
				// The zoom throws quickly, settling before the slower colour fade.
				const introTime = Math.acos(Math.max(-1, Math.min(1, 2 * introColour - 1))) / Math.PI;
				const zoomProgress = Math.min(1, (introTime * MOBILE_COLOUR_DURATION) / MOBILE_SCALE_DURATION);
				const zoomRemaining = 1 - gsap.parseEase(MOBILE_SCALE_EASE)(zoomProgress);
				const waveConfig = introSettings.get(host) ?? introDefaults;
				draw(passes.display, null, {
					source: height.read,
					scene,
					portrait,
					content,
					waterReveal: sceneIntros.get(host)?.waterReveal ?? 1,
					introColour,
					introZoom: 1 + 0.45 * zoomRemaining,
					fluidActive: Number(activeTime > 0),
					revealAspect: cssWidth / cssHeight,
					revealDark,
					rippleStrength: (introSettings.get(host) ?? introDefaults).strength,
					rippleWidth: (introSettings.get(host) ?? introDefaults).width,
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
					inFront: Number(!desktopLayout.matches || settings.inFront),
					strength: settings.intensity,
					refraction: settings.refraction,
					dispersion: settings.dispersion,
					iridescence: settings.iridescence,
				});
				if (host.dataset.liquidReady !== 'true') host.dataset.liquidReady = 'true';
			},
			destroy,
		};
	} catch (error) {
		destroy();
		throw error;
	}
}
