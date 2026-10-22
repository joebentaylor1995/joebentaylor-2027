const path = require('node:path');

// Security headers
// ------------
// NOTE • A Content-Security-Policy without nonces. Nonces would make every
// page render per request, switching off static rendering and Partial
// Prerendering, and the experimental SRI mode can't hash the inline scripts
// Next streams page data with, so inline scripts stay allowed. Everything
// else is locked to this origin: no third-party scripts, plugins, <base>
// hijacking, foreign form targets or framing by other sites.
// NOTE • Adding a third-party service? Add its origins below — e.g. a YouTube
// embed needs `frame-src https://www.youtube-nocookie.com`.
const isDev = process.env.NODE_ENV === 'development';
const hasGoogleAnalytics = Boolean(process.env.NEXT_PUBLIC_GA_ID);
// NOTE • Netlify injects its feedback drawer (an app.netlify.com iframe) into
// deploy previews and branch deploys — never production
const isNetlifyPreview = ['deploy-preview', 'branch-deploy'].includes(process.env.CONTEXT ?? '');

const googleAnalytics = {
	script: ['https://www.googletagmanager.com'],
	connect: [
		'https://*.google-analytics.com',
		'https://*.analytics.google.com',
		'https://*.googletagmanager.com',
		'https://www.google.com',
	],
};

// NOTE • The embedded Studio at /studio talks to Sanity's API (HTTPS + live
// listeners over WebSockets). Site pages fetch Sanity on the server only.
const sanity = {
	connect: ['https://*.sanity.io', 'wss://*.sanity.io'],
};

// NOTE • Sanity files are served from the R2 media Worker when it's set
// (src/utils/mediaUrl.ts). <video> is covered by media-src https:, but the 3D
// model viewer fetch()es its .glb, so the Worker's origin needs connect-src too
const media = {
	connect: process.env.NEXT_PUBLIC_MEDIA_URL ? [new URL(process.env.NEXT_PUBLIC_MEDIA_URL).origin] : [],
};

const contentSecurityPolicy = {
	'default-src': ["'self'"],
	// NOTE • React needs eval in development only, for its debugging stacks
	'script-src': [
		"'self'",
		"'unsafe-inline'",
		// NOTE • Lets the 3D model viewer compile its geometry decoders (meshopt,
		// Draco) — WebAssembly only, not JavaScript eval
		"'wasm-unsafe-eval'",
		...(isDev ? ["'unsafe-eval'"] : []),
		...(hasGoogleAnalytics ? googleAnalytics.script : []),
		'https://app.cal.com',
		// Consent-gated standard YouTube players pause while covered by Profile.
		'https://www.youtube.com',
		'https://s.ytimg.com',
	],
	'style-src': ["'self'", "'unsafe-inline'"],
	// NOTE • https: covers CMS images and media served straight from their CDNs
	'img-src': ["'self'", 'blob:', 'data:', 'https:'],
	'media-src': ["'self'", 'blob:', 'https:'],
	'font-src': ["'self'"],
	// NOTE • The Draco decoder (public/draco) runs in workers built from blob: URLs
	'worker-src': ["'self'", 'blob:'],
	'connect-src': [
		"'self'",
		...sanity.connect,
		...media.connect,
		...(hasGoogleAnalytics ? googleAnalytics.connect : []),
	],
	'frame-src': [
		"'self'",
		'https://cal.com',
		'https://app.cal.com',
		// Case-study YouTube media (marketing-consent gated) and its Studio preview
		'https://www.youtube-nocookie.com',
		...(isNetlifyPreview ? ['https://app.netlify.com'] : []),
	],
	'object-src': ["'none'"],
	'base-uri': ["'self'"],
	'form-action': ["'self'"],
	// NOTE • 'self' rather than 'none' so the site can preview inside its own
	// embedded Studio (Sanity's Presentation tool)
	'frame-ancestors': ["'self'"],
	// Safari upgrades localhost assets too; the development server only speaks HTTP.
	...(!isDev ? { 'upgrade-insecure-requests': [] } : {}),
};

const securityHeaders = [
	{
		key: 'Content-Security-Policy',
		value: Object.entries(contentSecurityPolicy)
			.map(([directive, sources]) => [directive, ...sources].join(' '))
			.join('; '),
	},
	// NOTE • Two years, this host only — add includeSubDomains once every
	// subdomain is HTTPS
	...(!isDev ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }] : []),
	{ key: 'X-Content-Type-Options', value: 'nosniff' },
	{ key: 'X-Frame-Options', value: 'SAMEORIGIN' },
	{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
	{ key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
	// Sass — styles are SCSS CSS Modules (styles.module.scss) plus the global
	// src/css/global.scss. `additionalData` prepends the Tackl SCSS layer
	// (src/css/tackl) to every .scss file, so bp(), the type and spacing mixins,
	// vw() and alpha() work with no imports. That layer emits no CSS itself.
	sassOptions: {
		implementation: 'sass-embedded',
		loadPaths: [path.join(__dirname, 'src/css')],
		additionalData: `@use 'tackl' as *;`,
	},

	// Image loader settings
	images: {
		formats: ['image/avif', 'image/webp'],
		qualities: [75, 90],
		// Optimized images are cached for a day — bump higher if your imagery
		// rarely changes (CMS images get new URLs on change anyway)
		minimumCacheTTL: 86400,
		// imageSizes defines the set of fixed image widths (in pixels) that Next.js will generate for images
		// when using the "sizes" attribute or for static image imports. These are typically used for icons,
		// avatars, or other images that are rendered at specific, small sizes.
		imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

		// deviceSizes defines the set of viewport widths (in pixels) that Next.js considers when generating
		// responsive images. These values are used to create different image versions for various device screen
		// sizes, enabling optimal image loading and performance across mobile, tablet, and desktop devices.
		// NOTE • 2560 bridges 2048 → 3840, so a phone's full-bleed cover image
		// (≈2,100–2,550px at 1.75–2× DPR) isn't rounded all the way up to 3840
		deviceSizes: [390, 640, 750, 828, 1080, 1200, 1400, 1920, 2048, 2560, 3840],
		remotePatterns: [
			{
				protocol: 'https',
				hostname: 'picsum.photos',
			},
			// Sanity image + file CDN
			{
				protocol: 'https',
				hostname: 'cdn.sanity.io',
			},
			// Stand-in for missing project imagery (PLACEHOLDER_IMAGE in src/data/site.ts)
			{
				protocol: 'https',
				hostname: 'via.placeholder.com',
			},
			// YouTube thumbnails, the still behind case-study YouTube media
			{
				protocol: 'https',
				hostname: 'i.ytimg.com',
			},
		],
	},
	// React Strict Mode is a development-only feature that helps identify potential problems
	// It enables additional checks and warnings for:
	// - Identifying unsafe lifecycles
	// - Warning about legacy string ref API usage
	// - Detecting unexpected side effects
	// - Ensuring reusable state
	// - Detecting legacy context API
	reactStrictMode: true,

	// Ensure trailing slashes are added to all routes
	trailingSlash: true,

	// Cache Components (Next 16) — data fetching is dynamic by default and you
	// opt into caching with the `use cache` directive at page, component or
	// function level. Next prerenders a static shell and streams the dynamic
	// parts in, so a route is no longer all-or-nothing static.
	//
	// It also turns on Partial Prerendering as the default App Router behaviour
	// (the old `experimental.ppr` flag is gone) and uses React's <Activity> to
	// keep recently visited routes mounted-but-hidden, so component state
	// survives a back navigation.
	//
	// NOTE • Requires the Node.js runtime — the `edge` runtime is deprecated in
	// 16.3 and unsupported here. Anything reading uncached I/O (`new Date()`,
	// `cookies()`, a CMS call) makes that route dynamic unless you mark it
	// `'use cache'` — see app/sitemap.ts for the pattern.
	cacheComponents: true,

	// Partial Prefetching (Next 16.3) — instead of prefetching a whole route per
	// visible <Link>, Next prefetches one reusable App Shell per route and fills
	// in the per-link bits (params, searchParams) on navigation. A page with 50
	// links to 3 routes fetches 3 shells rather than 50 route payloads.
	//
	// Requires `cacheComponents` above — `next dev`/`next build` throw at config
	// validation without it. Opt a single link into fetching its runtime data
	// with <Link prefetch={true}>, or a whole segment with `export const prefetch`.
	partialPrefetching: true,

	experimental: {
		webVitalsAttribution: ['CLS', 'LCP'],

		// A 404 for URLs that match no route (app/global-not-found.tsx). The
		// app has more than one root layout — (site), plus (studio) with Sanity —
		// so a root app/not-found.tsx has no layout to render inside.
		globalNotFound: true,

		// Turbopack persistent cache — saves compilation work under `.next` and
		// restores it on the next run. Both default to `true` as of 16.3; they
		// are spelled out here so the trade-off is visible.
		//
		// NOTE • The build cache only pays off when `.next/cache` survives between
		// builds. Netlify restores it for you; a container that starts from a
		// clean layer does not, so set `ForBuild` to false there rather than
		// writing a cache nothing will read.
		turbopackFileSystemCacheForDev: true,
		turbopackFileSystemCacheForBuild: true,

		// How aggressively Turbopack drops in-memory copies of cache data it has
		// already written to disk — the reason long dev sessions hold on to far
		// less RAM in 16.3. 'auto' evicts once enough has been allocated to be
		// worth it, 'full' evicts on every snapshot, `false` never evicts.
		// Only has an effect while the FileSystem cache above is enabled.
		turbopackMemoryEviction: 'auto',

		// Offline support — tracks connectivity via the browser's online/offline
		// events plus failed framework fetches, polls with HEAD requests while
		// down (backing off to 3s), and replays blocked navigations, prefetches
		// and Server Actions once the connection returns. Also exposes the
		// `useOffline` hook from 'next/offline' for offline UI in Client
		// Components.
		useOffline: true,

		// Prefetch inlining bundles small segment responses into a single
		// response rather than requesting each separately. On by default —
		// override the thresholds (bytes, gzipped) or set `false` when debugging
		// navigation or counting requests.
		// prefetchInlining: { maxSize: 2048, maxBundleSize: 10240 },

		// Production JS chunking. Defaults shown; sizes are bytes of uncompressed,
		// unminified code. `generateComponentChunks` additionally emits each
		// merged chunk's constituent parts so navigations can skip re-downloading
		// code the browser already has.
		// turbopackChunking: {
		// 	minChunkSize: 50000,
		// 	maxChunkCountPerGroup: 40,
		// 	maxMergeChunkSize: 200000,
		// 	minComponentChunkSize: 20000,
		// 	generateComponentChunks: false,
		// },

		// Native Rust port of the React Compiler, run inside Turbopack instead of
		// through Babel — much faster, and no `babel-plugin-react-compiler` to
		// install. Needs the top-level `reactCompiler: true` alongside it, and
		// throws under webpack.
		// turbopackRustReactCompiler: true,

		// Resolve `postcss.config.js` from each CSS file's own directory first,
		// falling back to the project root. Useful in a monorepo where packages
		// need different transforms; Tackl has a single root config.
		// turbopackLocalPostcssConfig: true,

		// `next build` type-checks by shelling out to the project-local `tsc`,
		// which is what makes TypeScript 6 (and, ahead of its JS API, TypeScript 7)
		// work. Set false to go back to the TypeScript compiler API.
		// useTypeScriptCli: false,
	},

	// `next dev` upserts a managed <!-- BEGIN:nextjs-agent-rules --> block into
	// AGENTS.md / CLAUDE.md pointing agents at the version-matched docs bundled
	// in node_modules/next/dist/docs. Anything outside the markers is preserved,
	// and the block is committed so the working tree stays clean. Set false to
	// stop Next writing to those files.
	agentRules: true,

	// Salt mixed into every content-addressed output filename. Change it to
	// force all chunk hashes to change and bust browser caches without touching
	// source. Concatenated with the NEXT_HASH_SALT env var when both are set.
	// outputHashSalt: 'tackl',

	// Security headers on every route except the embedded Sanity Studio, which
	// loads its own scripts and APIs and manages its own policy
	async headers() {
		return [{ source: '/((?!studio).*)', headers: securityHeaders }];
	},

	// The profile panel is an overlay, not a page — /profile/ is the address
	// Sanity's Presentation tool uses for it (src/utils/profileRoute.ts). Loading
	// it directly lands on the homepage with the panel open.
	async rewrites() {
		return [
			{ source: '/profile', destination: '/' },
			{ source: '/contact', destination: '/' },
		];
	},

	// Compiler settings
	compiler: {
		removeConsole: process.env.NODE_ENV === 'production',
	},
};

module.exports = nextConfig;
