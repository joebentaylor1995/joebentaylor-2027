// Imports
// ------------
import { type DecodeFetch, fetchImage } from './fetchImage';

// Types
// ------------
interface DecodeRequest {
	id: number;
	// A URL to fetch the way the page's <img> would, or bytes the page already fetched
	source: string | Blob;
	// The texels WebGL would upload from an <img>: alpha, colour conversion and flip
	options: ImageBitmapOptions;
	request?: DecodeFetch;
}

// Worker
// ------------
// Decodes an image into an ImageBitmap for texImage2D, then transfers it back without a copy.
// Decoding here keeps it off the main thread in every engine (Safari decodes a blob on the
// calling thread). Replies without a bitmap when the image can't be fetched or decoded.
self.onmessage = async (event: MessageEvent<DecodeRequest>) => {
	const { id, source, options, request } = event.data;
	try {
		const blob = typeof source === 'string' && request ? await fetchImage(source, request) : source;
		if (!(blob instanceof Blob)) throw new Error('Texture fetch failed');
		const bitmap = await createImageBitmap(blob, options);
		self.postMessage({ id, bitmap }, { transfer: [bitmap] });
	} catch {
		self.postMessage({ id });
	}
};
