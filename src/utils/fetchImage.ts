// Types
// ------------
// How to fetch an image the way the page's <img> did (plain data, so it survives
// postMessage): the request, and the Accept headers to try in turn
export interface DecodeFetch {
	mode: RequestMode;
	cache: RequestCache;
	credentials: RequestCredentials;
	accepts: string[];
}

// Exports
// ------------
// The image's bytes, trying each Accept header in turn (a cache-only request misses on the
// wrong one); null if none of them works
export async function fetchImage(url: string, { accepts, ...init }: DecodeFetch) {
	for (const accept of accepts) {
		try {
			const response = await fetch(url, { ...init, headers: { Accept: accept } });
			if (response.ok) return await response.blob();
		} catch {}
	}
	return null;
}
