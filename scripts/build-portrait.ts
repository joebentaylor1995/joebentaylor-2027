// Property Documentation
// ------------

// NOTE • Bakes the Connect section's face height map, so the site ships the 512px map the scene
// reads instead of the full-size photo:
//   scripts/data/portrait/face.png → public/images/connect/face.webp
// The photo goes through the very steps the page runs (the browser's own downscale, then
// portrait.worker.ts) in Playwright's Chromium. The resulting map is saved as a lossless WebP,
// and the saved file is then put through the same steps to prove it comes out unchanged.
// Run by hand after changing the photo: `bun run portrait` (needs Playwright's Chromium,
// `bunx playwright install chromium`).

// Imports
// ------------
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { chromium } from '@playwright/test';
// NOTE • sharp is installed with Next, as its image optimiser
import sharp from 'sharp';
import {
	PORTRAIT_MAP_WIDTH,
	PORTRAIT_SOURCE_SIZE,
	PORTRAIT_URL,
} from '../src/components/Profile/CallToAction/portrait';

// Constants
// ------------
const ROOT = path.resolve(import.meta.dir, '..');
const SOURCE = 'scripts/data/portrait/face.png';
const TARGET = path.join('public', PORTRAIT_URL);
const WORKER = 'src/components/Profile/CallToAction/portrait.worker.ts';

// A made-up origin: every request to it is answered from the files below
const ORIGIN = 'http://portrait.bake';
const WEBP_MAX_EFFORT = 6;
const WEBP_MAX_QUALITY = 100;

// Helpers
// ------------
// Runs in the page. The same steps as loadPortrait in CallToAction/engine.ts: draw the image at
// the map's width, read the pixels back, hand them to the portrait worker.
const heightMap = async ({ url, mapWidth }: { url: string; mapWidth: number }) => {
	const img = new Image();
	await new Promise((resolve, reject) => {
		img.onload = resolve;
		img.onerror = () => reject(new Error(`${url} could not load`));
		img.src = url;
	});
	const map = document.createElement('canvas');
	map.width = mapWidth;
	map.height = Math.round((mapWidth * img.height) / img.width);
	const context = map.getContext('2d');
	if (!context) throw new Error('Canvas unavailable');
	context.drawImage(img, 0, 0, map.width, map.height);
	const pixels = context.getImageData(0, 0, map.width, map.height);
	const worker = new Worker('/worker.js');
	const result = await new Promise<ImageData>((resolve, reject) => {
		worker.onmessage = event => resolve(event.data);
		worker.onerror = () => reject(new Error('Portrait worker failed'));
		worker.postMessage(pixels, [pixels.data.buffer]);
	});
	worker.terminate();

	// Pixels cross back to the script as base64 text
	const CHUNK = 0x8000;
	let binary = '';
	for (let i = 0; i < result.data.length; i += CHUNK)
		binary += String.fromCharCode(...result.data.subarray(i, i + CHUNK));
	return {
		width: result.width,
		height: result.height,
		source: { width: img.width, height: img.height },
		pixels: btoa(binary),
	};
};

// Run
// ------------
const bundle = await Bun.build({ entrypoints: [path.join(ROOT, WORKER)], target: 'browser' });
const workerSource = await bundle.outputs[0].text();
const images: Record<string, { contentType: string; body: Buffer }> = {
	'/photo': { contentType: 'image/png', body: readFileSync(path.join(ROOT, SOURCE)) },
};

const browser = await chromium.launch();
try {
	const page = await browser.newPage();
	await page.route(`${ORIGIN}/**`, route => {
		const { pathname } = new URL(route.request().url());
		if (pathname === '/worker.js') return route.fulfill({ contentType: 'text/javascript', body: workerSource });
		return route.fulfill(images[pathname] ?? { contentType: 'text/html', body: '<!doctype html>' });
	});
	await page.goto(ORIGIN);

	const map = await page.evaluate(heightMap, { url: '/photo', mapWidth: PORTRAIT_MAP_WIDTH });
	if (map.source.width !== PORTRAIT_SOURCE_SIZE.width || map.source.height !== PORTRAIT_SOURCE_SIZE.height)
		throw new Error(
			`The photo is ${map.source.width}×${map.source.height}: update PORTRAIT_SOURCE_SIZE in CallToAction/portrait.ts to match`
		);

	const baked = await sharp(Buffer.from(map.pixels, 'base64'), {
		raw: { width: map.width, height: map.height, channels: 4 },
	})
		.removeAlpha()
		.webp({ lossless: true, effort: WEBP_MAX_EFFORT, quality: WEBP_MAX_QUALITY })
		.toBuffer();

	// NOTE • Why: the page still runs the worker over the shipped file. That leaves the map alone
	// as long as none of its near-white pixels touch the image edge (the worker would take them
	// for backdrop), so check rather than assume.
	images['/baked'] = { contentType: 'image/webp', body: baked };
	const shipped = await page.evaluate(heightMap, { url: '/baked', mapWidth: PORTRAIT_MAP_WIDTH });
	if (shipped.pixels !== map.pixels)
		throw new Error('The baked map does not come back unchanged from the portrait worker');

	writeFileSync(path.join(ROOT, TARGET), baked);
	console.log(`Generated ${TARGET} (${map.width}×${map.height}, ${baked.length} bytes)`);
} finally {
	await browser.close();
}
