import { gsap } from 'gsap';
import { fragment, vertex } from './reveal-shaders';

// One viewport-sized renderer shared by all tiles. Flat tiles keep their native media.
export function mountMediaReveal(root: HTMLElement, canvas: HTMLCanvasElement) {
	const gl = canvas.getContext('webgl', { alpha: true, antialias: true, depth: false, powerPreference: 'low-power' });
	if (!gl) return () => {};
	const program = gl.createProgram();
	const buffer = gl.createBuffer();
	if (!program || !buffer) return () => {};
	const shaders: WebGLShader[] = [];
	for (const [type, source] of [
		[gl.VERTEX_SHADER, vertex],
		[gl.FRAGMENT_SHADER, fragment],
	] as const) {
		const shader = gl.createShader(type);
		if (!shader) continue;
		shaders.push(shader);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		gl.attachShader(program, shader);
	}
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		for (const shader of shaders) gl.deleteShader(shader);
		gl.deleteProgram(program);
		gl.deleteBuffer(buffer);
		return () => {};
	}
	// biome-ignore lint/correctness/useHookAtTopLevel: WebGL method.
	gl.useProgram(program);
	const points = [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1];
	gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.STATIC_DRAW);
	const position = gl.getAttribLocation(program, 'position');
	gl.enableVertexAttribArray(position);
	gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
	const uniforms = Object.fromEntries(
		['viewport', 'box', 'progress', 'cover', 'tileSize', 'radius'].map(name => [
			name,
			gl.getUniformLocation(program, name),
		])
	);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
	const tiles = Array.from(root.querySelectorAll<HTMLElement>('[data-media-tile]')).map(slot => ({
		slot,
		figure: slot.querySelector('figure'),
		media: slot.querySelector<HTMLImageElement | HTMLVideoElement>('img, video'),
		texture: null as WebGLTexture | null,
		src: '',
		failed: false,
		radius: 0,
		frameTime: -1,
		decodedFrame: 0,
		frameCallback: 0,
	}));
	let dirty = true;
	let lastTop = Number.NaN;
	let width = 0;
	let height = 0;
	let active = false;
	for (const tile of tiles) {
		const video = tile.media;
		if (!(video instanceof HTMLVideoElement) || !video.requestVideoFrameCallback) continue;
		const frame = () => {
			tile.decodedFrame++;
			if (tile.slot.dataset.revealing === 'true') dirty = true;
			tile.frameCallback = video.requestVideoFrameCallback(frame);
		};
		tile.frameCallback = video.requestVideoFrameCallback(frame);
	}
	const restore = () => {
		for (const tile of tiles) delete tile.slot.dataset.revealing;
	};
	const resize = () => {
		width = root.clientWidth;
		height = window.innerHeight;
		const ratio = Math.min(devicePixelRatio || 1, 2);
		canvas.width = Math.max(1, Math.round(width * ratio));
		canvas.height = Math.max(1, Math.round(height * ratio));
		gl.viewport(0, 0, canvas.width, canvas.height);
		gl.uniform2f(uniforms.viewport, width, height);
		for (const tile of tiles)
			tile.radius = tile.figure ? Number.parseFloat(getComputedStyle(tile.figure).borderRadius) || 0 : 0;
		dirty = true;
	};
	const draw = () => {
		if (document.hidden || gl.isContextLost()) return;
		const bounds = root.getBoundingClientRect();
		const movingVideo = tiles.some(
			t =>
				t.slot.dataset.revealing === 'true' &&
				t.media instanceof HTMLVideoElement &&
				!t.media.paused &&
				!t.media.requestVideoFrameCallback
		);
		if (!dirty && Math.abs(bounds.top - lastTop) < 0.01 && !movingVideo) return;
		lastTop = bounds.top;
		dirty = false;
		// Read layout together before changing canvas or tile visibility.
		const boxes = tiles.map(tile => tile.slot.getBoundingClientRect());
		canvas.style.transform = `translateY(${-bounds.top}px)`;
		gl.clear(gl.COLOR_BUFFER_BIT);
		for (const [index, tile] of tiles.entries()) {
			const box = boxes[index];
			const progress = Math.max(0, Math.min(1, (height - box.top) / (height * 0.3)));
			tile.slot.dataset.revealProgress = progress.toFixed(3);
			const revealing = progress < 0.999 && box.top < height && box.bottom > 0;
			const nearby = progress < 0.999 && box.top < height + 400 && box.bottom > 0;
			if (!tile.media || !tile.figure || tile.failed || (!revealing && !nearby)) {
				delete tile.slot.dataset.revealing;
				if ((box.bottom < -height || box.top > height * 2) && tile.texture) {
					gl.deleteTexture(tile.texture);
					tile.texture = null;
					tile.src = '';
				}
				continue;
			}
			const media = tile.media;
			const video = media instanceof HTMLVideoElement;
			const mediaWidth = video ? media.videoWidth : media.naturalWidth;
			const mediaHeight = video ? media.videoHeight : media.naturalHeight;
			if (!mediaWidth || !mediaHeight || (video && media.readyState < 2)) continue;
			if (!revealing) delete tile.slot.dataset.revealing;
			if (!tile.texture) {
				tile.texture = gl.createTexture();
				gl.bindTexture(gl.TEXTURE_2D, tile.texture);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
				gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
			} else gl.bindTexture(gl.TEXTURE_2D, tile.texture);
			try {
				const frame = video
					? typeof media.requestVideoFrameCallback === 'function'
						? tile.decodedFrame
						: media.currentTime
					: 0;
				if ((video && tile.frameTime !== frame) || tile.src !== media.currentSrc) {
					gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, media);
					tile.src = media.currentSrc;
					if (video) tile.frameTime = frame;
				}
			} catch {
				tile.failed = true;
				delete tile.slot.dataset.revealing;
				continue;
			}
			if (!revealing) continue;
			const aspect = box.width / box.height;
			const sourceAspect = mediaWidth / mediaHeight;
			gl.uniform2f(uniforms.cover, Math.min(1, aspect / sourceAspect), Math.min(1, sourceAspect / aspect));
			gl.uniform2f(uniforms.tileSize, box.width, box.height);
			gl.uniform4f(uniforms.box, box.left - bounds.left, box.top, box.width, box.height);
			gl.uniform1f(uniforms.progress, progress * progress * (3 - 2 * progress));
			gl.uniform1f(uniforms.radius, tile.radius);
			gl.drawArrays(gl.TRIANGLES, 0, points.length / 2);
			tile.slot.dataset.revealing = 'true';
		}
	};
	const loaded = () => {
		dirty = true;
	};
	const lost = (event: Event) => {
		event.preventDefault();
		restore();
		gsap.ticker.remove(draw);
	};
	const observer = new IntersectionObserver(
		entries => {
			const visible = entries.some(entry => entry.isIntersecting);
			if (visible === active) return;
			active = visible;
			if (active) {
				dirty = true;
				gsap.ticker.add(draw);
			} else {
				gsap.ticker.remove(draw);
				restore();
			}
		},
		{ rootMargin: '200px' }
	);
	const size = new ResizeObserver(resize);
	size.observe(root);
	window.addEventListener('resize', resize);
	root.addEventListener('load', loaded, true);
	root.addEventListener('loadeddata', loaded, true);
	canvas.addEventListener('webglcontextlost', lost);
	resize();
	observer.observe(root);
	canvas.dataset.revealReady = 'true';
	return () => {
		gsap.ticker.remove(draw);
		observer.disconnect();
		size.disconnect();
		window.removeEventListener('resize', resize);
		root.removeEventListener('load', loaded, true);
		root.removeEventListener('loadeddata', loaded, true);
		canvas.removeEventListener('webglcontextlost', lost);
		restore();
		delete canvas.dataset.revealReady;
		for (const tile of tiles) {
			if (tile.frameCallback && tile.media instanceof HTMLVideoElement)
				tile.media.cancelVideoFrameCallback(tile.frameCallback);
			gl.deleteTexture(tile.texture);
		}
		for (const shader of shaders) gl.deleteShader(shader);
		gl.deleteBuffer(buffer);
		gl.deleteProgram(program);
	};
}
