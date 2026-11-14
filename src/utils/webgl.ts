// Imports
// ------------
import { type DecodeFetch, fetchImage } from './fetchImage';

// Types
// ------------
type GL = WebGLRenderingContext | WebGL2RenderingContext;

// An image ready for texImage2D: an ImageBitmap decoded off the main thread (already
// flipped when asked), or the fallback <img> when a bitmap couldn't be made
export type TextureImage = ImageBitmap | HTMLImageElement;

// Constants
// ------------
// NOTE • Matches WebGL's defaults for an <img> upload: straight (unpremultiplied) alpha
// and the browser's default colour conversion. WebGL ignores its UNPACK_* settings for an
// ImageBitmap, so the bitmap has to carry them itself to give the same texels.
const BITMAP_OPTIONS = { premultiplyAlpha: 'none', colorSpaceConversion: 'default' } as const;
// NOTE • The Accept header each engine sends for <img>, newest first. Next's /_next/image (and
// Netlify's image CDN) pick AVIF or WebP from it and vary on it, so a request with any other
// Accept gets a different file and misses the <img>'s HTTP-cache entry.
const IMAGE_ACCEPTS = {
	chromium: [
		'image/jxl,image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
		'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
	],
	webkit: [
		'image/webp,image/avif,image/jxl,image/heic,image/heic-sequence,video/*;q=0.8,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5',
	],
	gecko: ['image/avif,image/webp,image/png,image/svg+xml,image/*;q=0.8,*/*;q=0.5'],
};
const LINK_POLL_MS = 16;
// Between fence checks: sync status only updates between tasks, and a short timer starts the
// next upload as soon as the GPU is free rather than at the next frame
const FENCE_POLL_MS = 4;

// Helpers
// ------------
// This engine's image Accept headers (every iOS browser is WebKit). Chromium is told apart by
// navigator.userAgentData, which a spoofed or "desktop site" user agent string doesn't remove.
const imageAccepts = () => {
	if (typeof navigator === 'undefined') return IMAGE_ACCEPTS.chromium;
	if ('userAgentData' in navigator) return IMAGE_ACCEPTS.chromium;
	const agent = navigator.userAgent;
	if (/Firefox\//.test(agent)) return IMAGE_ACCEPTS.gecko;
	if (/AppleWebKit\//.test(agent) && !/Chrome\/|Chromium\/|Edg\//.test(agent)) return IMAGE_ACCEPTS.webkit;
	return IMAGE_ACCEPTS.chromium;
};

// One decode worker for the page, started on first use; null once it has failed to start
let decoder: Worker | null | undefined;
let nextRequest = 0;
const requests = new Map<number, { resolve: (bitmap: ImageBitmap | null) => void; reject: (error: Error) => void }>();

// NOTE • Chromium only (navigator.userAgentData, the gate public/projects-ribbon/gl-async.js
// uses too). WebKit backs an ImageBitmap with premultiplied pixels whatever premultiplyAlpha
// says, so every fully transparent texel of the hero portraits would lose its colour — the
// edge fringe the straight-alpha <img> upload avoids. Safari and Firefox keep that upload.
const canDecodeOffThread = () =>
	typeof createImageBitmap === 'function' && typeof navigator !== 'undefined' && 'userAgentData' in navigator;

// Decodes in the shared worker. Resolves null when the worker couldn't fetch or decode the
// image, and rejects when there is no worker (CSP, failed start) so the caller can decode here.
function decodeInWorker(source: string | Blob, options: ImageBitmapOptions, request?: DecodeFetch) {
	if (decoder === undefined) {
		try {
			decoder = new Worker(new URL('./textureImage.worker.ts', import.meta.url));
			decoder.onmessage = (event: MessageEvent<{ id: number; bitmap?: ImageBitmap }>) => {
				const pending = requests.get(event.data.id);
				requests.delete(event.data.id);
				pending?.resolve(event.data.bitmap ?? null);
			};
			decoder.onerror = () => {
				for (const pending of requests.values()) pending.reject(new Error('Texture worker failed'));
				requests.clear();
				decoder?.terminate();
				decoder = null;
			};
		} catch {
			decoder = null;
		}
	}
	const worker = decoder;
	if (!worker) return Promise.reject(new Error('Texture worker unavailable'));
	return new Promise<ImageBitmap | null>((resolve, reject) => {
		const id = ++nextRequest;
		requests.set(id, { resolve, reject });
		worker.postMessage({ id, source, options, request });
	});
}

// The same fetch-and-decode as the worker, on this thread (Chromium still decodes the blob
// off it); null on any failure
async function decodeHere(url: string, options: ImageBitmapOptions, request: DecodeFetch) {
	const blob = await fetchImage(url, request);
	return blob && createImageBitmap(blob, options).catch(() => null);
}

// The decoded <img> itself, which texImage2D decodes again on the main thread (today's path)
async function decodedElement(image: HTMLImageElement | null, url: string) {
	const element = image ?? Object.assign(new Image(), { crossOrigin: 'anonymous', src: url });
	await element.decode();
	return element;
}

// NOTE • An <img> the page already loaded is in the HTTP cache, so it's read from there and
// never downloaded twice (a miss falls back to that <img>). A URL only the texture uses is
// fetched normally. only-if-cached is only allowed for same-origin requests.
function textureFetch(url: string, image: HTMLImageElement | null): DecodeFetch {
	const credentials = image?.crossOrigin === 'use-credentials' ? 'include' : 'same-origin';
	const accepts = imageAccepts();
	if (!image) return { mode: 'cors', cache: 'default', credentials, accepts: accepts.slice(0, 1) };
	if (new URL(url).origin === location.origin)
		return { mode: 'same-origin', cache: 'only-if-cached', credentials, accepts };
	return { mode: 'cors', cache: 'force-cache', credentials, accepts: accepts.slice(0, 1) };
}

// Exports
// ------------
// This engine's image Accept header, for fetching an image the way an <img> would
export const imageAccept = () => imageAccepts()[0];

// Linear filtering, clamped at the edges, for the texture currently bound to TEXTURE_2D
export function setClampedLinear(gl: WebGLRenderingContext) {
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
}

// NOTE • Why: Safari decodes createImageBitmap(blob) synchronously on the calling thread, so a
// burst of decodes there lands on the main thread mid-scroll. The shared worker decodes them
// instead; with no worker the decode runs here, as before. Rejects if the bytes don't decode.
export async function decodeBitmap(blob: Blob, options: ImageBitmapOptions) {
	const bitmap = await decodeInWorker(blob, options).catch(() => undefined);
	if (bitmap === undefined) return createImageBitmap(blob, options);
	if (!bitmap) throw new Error('Image decode failed');
	return bitmap;
}

// NOTE • Why: texImage2D(<img>) decodes the whole image again, synchronously, on the main
// thread (img.decode() only warms the compositor's copy, which WebGL can't use). For a 4K
// photo that's a 70-300ms frame. Reading the same bytes (an HTTP-cache hit) and decoding them
// into an ImageBitmap in a worker keeps it off the main thread.
// Falls back to decoding on this thread, then to the decoded <img> (cache miss, CSP, CORS,
// non-Chromium engines).
export async function decodeTextureImage(source: HTMLImageElement | string, flipY = false): Promise<TextureImage> {
	const image = typeof source === 'string' ? null : source;
	const url = new URL(image ? image.currentSrc || image.src : (source as string), document.baseURI).href;
	if (!canDecodeOffThread()) return decodedElement(image, url);
	const request = textureFetch(url, image);
	const options: ImageBitmapOptions = { ...BITMAP_OPTIONS, imageOrientation: flipY ? 'flipY' : 'from-image' };
	const bitmap = await decodeInWorker(url, options, request).catch(() => decodeHere(url, options, request));
	return bitmap ?? decodedElement(image, url);
}

// Uploads a decoded image to the bound TEXTURE_2D, flipping an <img> fallback the way the
// bitmap was already flipped
export function uploadTextureImage(gl: GL, image: TextureImage, flipY = false) {
	const flipElement = flipY && !(image instanceof ImageBitmap);
	if (flipElement) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
	if (flipElement) gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
}

// NOTE • Why: a big upload (or a mipmap build) can take the GPU process tens of ms. Issuing the
// next one straight after fills the command transfer buffer, and the main thread then blocks
// until the GPU catches up (WaitForToken) — a dropped frame per texture. This resolves once the
// GPU has finished everything issued so far, checked every few ms with a WebGL2 fence, which
// never blocks, so the next upload goes out as soon as the GPU is free. WebGL1 has no fences,
// so it simply waits a frame.
export function whenGpuCaughtUp(gl: GL) {
	if (typeof WebGL2RenderingContext === 'undefined' || !(gl instanceof WebGL2RenderingContext)) {
		return new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
	}
	const fence = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
	gl.flush();
	return new Promise<void>(resolve => {
		const check = () => {
			if (fence && !gl.isContextLost() && gl.clientWaitSync(fence, 0, 0) === gl.TIMEOUT_EXPIRED) {
				setTimeout(check, FENCE_POLL_MS);
				return;
			}
			if (fence && !gl.isContextLost()) gl.deleteSync(fence);
			resolve();
		};
		setTimeout(check, FENCE_POLL_MS);
	});
}

// NOTE • KHR_parallel_shader_compile only works if it was enabled before linkProgram: Chrome
// starts tracking a program's completion without blocking at link time, and only when the
// extension is already on. Call this straight after getContext.
export const enableParallelCompile = (gl: GL) => gl.getExtension('KHR_parallel_shader_compile');

// NOTE • Why: reading LINK_STATUS (or COMPILE_STATUS) straight after linkProgram blocks the
// main thread until the GPU process has compiled the shaders — tens to hundreds of ms on a
// cold cache, and longer while the GPU process is busy compiling the page's own effects.
// This polls KHR_parallel_shader_compile's non-blocking status between frames instead (see
// enableParallelCompile). Resolves false if `cancelled()` turns true or the context is lost
// meanwhile; the caller then reads LINK_STATUS as before.
export async function waitForProgram(gl: GL, program: WebGLProgram, cancelled: () => boolean) {
	const parallel = gl.getExtension('KHR_parallel_shader_compile');
	const linked = () => !!parallel && gl.getProgramParameter(program, parallel.COMPLETION_STATUS_KHR) === true;
	if (linked()) return true;
	do {
		await new Promise(resolve => setTimeout(resolve, LINK_POLL_MS));
		if (cancelled() || gl.isContextLost()) return false;
	} while (parallel && !linked());
	return true;
}
