'use strict';

// GL async
// ------------
// Non-blocking WebGL helpers shared by the ribbon's scripts; loaded before all of them. The ribbon runs in a
// same-origin frame, so its JavaScript shares the host page's main thread: any call that waits on the GPU process
// (a status read, getError, a texture upload that decodes) stalls the whole site, scroll included. While the GPU
// process is busy compiling the host's own pipelines, a single such wait has measured 220-405 ms.
// These keep every result exactly as before and only change when it is read.

// How often a pending link is polled (one 120 Hz frame, so readiness lags the GPU by no more than that; each poll is a
// cheap local check), and the longest the polling waits before falling back to the blocking read the ribbon always
// used (only reached if a driver never reports completion).
const GL_POLL_MS = 8;
const GL_POLL_LIMIT_MS = 4000;

// The trivial program relinked by whenGpuCaughtUp(), one per context.
const glMarkers = new WeakMap();

// NOTE • KHR_parallel_shader_compile must be enabled before linkProgram: Chrome only tracks a program's completion
// without a round trip to the GPU process when the extension was already on when it was linked.
function parallelCompile(gl) {
	return gl.getExtension('KHR_parallel_shader_compile');
}

// Compiles `[type, source]` pairs and links them without reading any status back, so the GPU process compiles while
// the main thread carries on. Returns { program, shaders } for whenLinked() and checkProgram().
function linkProgramAsync(gl, sources) {
	parallelCompile(gl);
	const program = gl.createProgram();
	const shaders = sources.map(([type, source]) => {
		const shader = gl.createShader(type);
		gl.shaderSource(shader, source);
		gl.compileShader(shader);
		gl.attachShader(program, shader);
		return shader;
	});
	gl.linkProgram(program);
	return { program, shaders };
}

// Resolves once `program` has finished linking, polling between frames instead of blocking. Without the extension
// (or once the context is lost) it resolves straight away, and the status read that follows blocks as it always did.
function whenLinked(gl, program) {
	const parallel = parallelCompile(gl),
		started = performance.now();
	return new Promise(resolve => {
		const poll = () => {
			if (
				!parallel ||
				gl.isContextLost() ||
				performance.now() - started > GL_POLL_LIMIT_MS ||
				gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR)
			)
				resolve();
			else setTimeout(poll, GL_POLL_MS);
		};
		poll();
	});
}

// Reads a link's result and throws exactly what the old synchronous checks threw: the info log of the first shader
// that failed to compile (vertex first), else the program's link log. On failure the program is deleted; with
// `release` the shaders are deleted once it has linked (deleting attached shaders only flags them).
function checkProgram(gl, { program, shaders }, release = false) {
	if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
		if (release) for (const shader of shaders) gl.deleteShader(shader);
		return program;
	}
	const failed = shaders.find(shader => !gl.getShaderParameter(shader, gl.COMPILE_STATUS));
	const log = failed ? gl.getShaderInfoLog(failed) : gl.getProgramInfoLog(program);
	gl.deleteProgram(program);
	for (const shader of shaders) gl.deleteShader(shader);
	throw Error(log);
}

// NOTE • WebGL1 has no fences. A link's completion is only reported once the GPU process has run every command issued
// before it, so relinking a trivial program tells us, without blocking, when an upload has landed. A getError or
// checkFramebufferStatus straight after then answers at once instead of waiting for the upload behind it.
function whenGpuCaughtUp(gl) {
	if (!parallelCompile(gl) || gl.isContextLost()) return Promise.resolve();
	let marker = glMarkers.get(gl);
	if (marker) gl.linkProgram(marker);
	else {
		marker = linkProgramAsync(gl, [
			[gl.VERTEX_SHADER, 'void main() { gl_Position = vec4(0.); }'],
			[gl.FRAGMENT_SHADER, 'void main() { gl_FragColor = vec4(0.); }'],
		]).program;
		glMarkers.set(gl, marker);
	}
	return whenLinked(gl, marker);
}

// The Accept headers Chromium sends for <img>, newest first (as in src/utils/webgl.ts). /_next/image picks its format
// from the Accept header and varies on it, so a cache-only read finds the <img>'s entry only with the same header.
const IMAGE_ACCEPTS = [
	'image/jxl,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
	'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
];

// NOTE • Why: texImage2D(<img>) decodes the whole image again, synchronously on the main thread (img.decode() only
// warms the compositor's copy, which WebGL can't use): about 67 ms for a case-study hero. Reading the very bytes the
// <img> loaded back from the HTTP cache and decoding them with createImageBitmap happens on a worker thread instead.
// The bitmap options are WebGL's defaults for an <img> upload (no premultiply, the browser's colour conversion, the
// file's own orientation), so the texels are the same. Same-origin only, and cache-only (never a second download),
// sending the <img>'s own Accept header so a negotiated URL returns the bytes the <img> decoded.
// Chromium only (navigator.userAgentData is its feature): there the bitmap keeps straight alpha exactly, while WebKit
// stores bitmaps premultiplied (losing colour under transparency) and decodes them on the main thread regardless.
// Resolves null whenever the cached bytes can't be used, and the caller uploads the <img> exactly as before.
async function decodeTextureBitmap(image) {
	if (typeof createImageBitmap !== 'function' || !navigator.userAgentData) return null;
	const url = new URL(image.currentSrc || image.src, location.href);
	if (url.origin !== location.origin) return null;
	for (const accept of IMAGE_ACCEPTS) {
		try {
			const response = await fetch(url, { mode: 'same-origin', cache: 'only-if-cached', headers: { Accept: accept } });
			if (!response.ok) continue;
			const bitmap = await createImageBitmap(await response.blob(), {
				imageOrientation: 'from-image',
				premultiplyAlpha: 'none',
				colorSpaceConversion: 'default',
			});
			if (bitmap.width === image.naturalWidth && bitmap.height === image.naturalHeight) return bitmap;
			bitmap.close();
			return null;
		} catch {}
	}
	return null;
}
