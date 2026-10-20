// Media Worker — CMS files served from R2
// ------------
// NOTE • Paths mirror Sanity's file CDN (/files/<project>/<dataset>/<sha1>.<ext>),
// so the site only swaps the host (src/utils/mediaUrl.ts). A miss pulls the file
// from cdn.sanity.io once and keeps it in R2; every later request — video range
// requests included — is served from R2, whose egress is free. Sanity file URLs
// are content-hashed, so an object never changes and can be cached forever.
// Setup and deploy: docs/Sanity/R2Media.md
// NOTE • `Env` (the MEDIA bucket + vars in wrangler.jsonc) and the runtime types
// come from worker-configuration.d.ts — regenerate with `bunx wrangler types`

// Constants
// ------------
const SANITY_CDN = 'https://cdn.sanity.io';
const CACHE_FOREVER = 'public, max-age=31536000, immutable';
const FILE_NAME = /^[a-f0-9]{40}\.[a-z0-9]+$/;

// NOTE • The projects ribbon draws video loops into WebGL, which needs CORS
const CORS = {
	'access-control-allow-origin': '*',
	'access-control-allow-methods': 'GET, HEAD, OPTIONS',
	'access-control-allow-headers': 'range, if-none-match, if-modified-since',
	'access-control-expose-headers': 'content-length, content-range, accept-ranges, etag',
};

// Helpers
// ------------
// NOTE • Only this project's files — the Worker must never be an open proxy
const toKey = (pathname: string, env: Env) => {
	const prefix = `/files/${env.SANITY_PROJECT_ID}/${env.SANITY_DATASET}/`;
	if (!pathname.startsWith(prefix)) return null;

	return FILE_NAME.test(pathname.slice(prefix.length)) ? pathname.slice(1) : null;
};

const notFound = () => new Response('Not found', { status: 404, headers: CORS });

// NOTE • Read flat: R2 can return every key with the unused ones undefined
const byteSpan = (
	{ offset = 0, length, suffix }: { offset?: number; length?: number; suffix?: number },
	size: number
) => {
	if (suffix !== undefined) return { start: size - suffix, end: size - 1 };

	return { start: offset, end: length === undefined ? size - 1 : offset + length - 1 };
};

const mirrorFromSanity = async (key: string, env: Env) => {
	const upstream = await fetch(`${SANITY_CDN}/${key}`);
	if (!upstream.ok) return false;

	await env.MEDIA.put(key, await upstream.arrayBuffer(), {
		httpMetadata: {
			contentType: upstream.headers.get('content-type') ?? 'application/octet-stream',
			cacheControl: CACHE_FOREVER,
		},
	});
	return true;
};

const serveFromBucket = async (request: Request, key: string, env: Env) => {
	const object = await env.MEDIA.get(key, { range: request.headers, onlyIf: request.headers });
	if (!object) return null;

	const headers = new Headers(CORS);
	object.writeHttpMetadata(headers);
	headers.set('etag', object.httpEtag);
	headers.set('cache-control', CACHE_FOREVER);
	headers.set('accept-ranges', 'bytes');

	// NOTE • No body means a conditional header (If-None-Match…) matched
	if (!('body' in object)) return new Response(null, { status: 304, headers });

	const body = request.method === 'HEAD' ? null : object.body;
	if (!request.headers.has('range') || !object.range) {
		headers.set('content-length', String(object.size));
		return new Response(body, { status: 200, headers });
	}

	const { start, end } = byteSpan(object.range, object.size);
	headers.set('content-range', `bytes ${start}-${end}/${object.size}`);
	headers.set('content-length', String(end - start + 1));
	return new Response(body, { status: 206, headers });
};

// Exports
// ------------
export default {
	async fetch(request, env): Promise<Response> {
		if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
		if (request.method !== 'GET' && request.method !== 'HEAD') {
			return new Response('Method not allowed', { status: 405, headers: { allow: 'GET, HEAD, OPTIONS' } });
		}

		const key = toKey(new URL(request.url).pathname, env);
		if (!key) return notFound();

		try {
			const cached = await serveFromBucket(request, key, env);
			if (cached) return cached;

			if (!(await mirrorFromSanity(key, env))) return notFound();
			return (await serveFromBucket(request, key, env)) ?? notFound();
		} catch (error: unknown) {
			// NOTE • R2 rejects unsatisfiable ranges by throwing
			console.error('Media request failed:', error);
			return request.headers.has('range')
				? new Response('Range not satisfiable', { status: 416, headers: CORS })
				: new Response('Media unavailable', { status: 502, headers: CORS });
		}
	},
} satisfies ExportedHandler<Env>;
