// Imports
// ------------
import { expect, test } from '@playwright/test';

// Constants
// ------------
// Half-width (in %) of PageTitleReveal's soft wave edge: its gradient turns transparent at --tfw-fill + 8%
const TITLE_WAVE_SOFT_EDGE = 8;
// The loader's CSS fail-open delay (SiteLoader styles.module.scss)
const LOADER_FAIL_OPEN_MS = 9000;
// How long the homepage loader waits for the WebGL scene before revealing without it (SiteLoader timeline.ts)
const HOMEPAGE_SCENE_DEADLINE_MS = 15000;
// Asset wait (at most 1.5s), the intro to the landed logo, the hold and the wave
const LOADER_INTRO_AND_WAVE_MS = 5000;
// Headroom for a slow runner
const EXPECT_SLACK_MS = 3000;

// Tests
// ------------
// Protects the loader on routes other than the homepage and the projects listing: it fades out (no wave), the
// view-transition is not involved, the aperture closes and the page title reveals afterwards.
for (const route of ['/projects/pocketchange/', '/cookies']) {
	test(`non-homepage loader fades without a wave on ${route}`, async ({ page }) => {
		await page.goto(route);
		const loader = page.locator('[data-site-loader]');
		await expect(loader).toHaveAttribute('data-outro', 'fade');
		await expect(page.locator('html')).toHaveAttribute('data-loader-pending');
		expect(await page.locator('html').evaluate(el => getComputedStyle(el, '::view-transition').display)).toBe(
			'none'
		);
		await expect(loader).toHaveAttribute('data-complete', 'true', { timeout: 10000 });
		await expect(page.locator('html')).not.toHaveAttribute('data-loader-pending');
		await expect(page.locator('[data-circle-aperture]')).toHaveAttribute('r', '0');
		await expect(page.locator('[data-loader-ring]')).toHaveCSS('opacity', '0');
		await expect(page.locator('[data-glitch-aperture]')).toHaveCount(0);
		await expect(loader).toBeHidden();
		const title = page.locator('h1 [data-page-title-reveal]');
		await expect(title).toHaveAttribute('data-wave-state', 'complete');
		await expect(title).toBeVisible();
	});
}

// Protects the projects listing loader: unlike other inner pages it opens the ribbon with the wave (the
// listing is excluded from the fade since 8a07e80, so the ribbon's refraction can follow the wavefront),
// without involving the view-transition, and it still clears completely.
test('projects listing loader opens the ribbon with the wave', async ({ page }) => {
	await page.goto('/projects/');
	const loader = page.locator('[data-site-loader]');
	await expect(loader).toHaveAttribute('data-outro', 'wave');
	await expect(page.locator('html')).toHaveAttribute('data-loader-pending');
	expect(await page.locator('html').evaluate(el => getComputedStyle(el, '::view-transition').display)).toBe('none');
	await expect(loader).toHaveAttribute('data-complete', 'true', { timeout: 15000 });
	await expect(page.locator('html')).not.toHaveAttribute('data-loader-pending');
	// The wavefront opened the aperture rather than fading the loader over a closed one
	expect(Number(await page.locator('[data-circle-aperture]').getAttribute('r'))).toBeGreaterThan(0);
	await expect(page.locator('[data-loader-ring]')).toHaveCSS('opacity', '0');
	await expect(page.locator('[data-glitch-aperture]')).toHaveCount(0);
	await expect(loader).toBeHidden();
});

// Protects the mobile case study loader: the loader fades (no radial wave, 48c9ac8) and the title's wave
// reveal (the case study hero's only variant since 8a07e80) stays hidden until the loader is done.
test('mobile project fades the loader and holds the title reveal until it is done', async ({ page }) => {
	await page.setViewportSize({ width: 440, height: 780 });
	await page.goto('/projects/pocketchange/');
	const loader = page.locator('[data-site-loader]');
	const title = page.locator('h1 [data-page-title-reveal]');
	await expect(title).toHaveAttribute('data-wave-state', 'waiting');
	await expect(title).toHaveAttribute('data-reveal-variant', 'wave');
	// Waiting: the text is painted by a gradient whose transparent stop (at --tfw-fill + 8%) still sits
	// before the text's first pixel, so none of the title shows. State and fill are read together, so the
	// reveal can't start between the two reads.
	await expect(title).toHaveCSS('-webkit-text-fill-color', 'rgba(0, 0, 0, 0)');
	const waiting = await title.evaluate(el => ({
		state: (el as HTMLElement).dataset.waveState,
		fill: Number.parseFloat(getComputedStyle(el).getPropertyValue('--tfw-fill')),
	}));
	expect(waiting.state).toBe('waiting');
	expect(waiting.fill + TITLE_WAVE_SOFT_EDGE).toBeLessThanOrEqual(0);
	await expect(page.locator('[data-circle-aperture]')).toHaveAttribute('r', '0');
	await expect.poll(() => loader.evaluate(element => Number(getComputedStyle(element).opacity))).toBeLessThan(1);
	await expect(loader).toHaveAttribute('data-complete', 'true');
	await expect(page.locator('[data-circle-aperture]')).toHaveAttribute('r', '0');
	await expect(title).toHaveAttribute('data-wave-state', 'complete');
	await expect(page.locator('[data-project-water]')).toHaveAttribute('data-intro', 'complete');
});

// Protects the mobile homepage loader: the scene cover is not used, the aperture is centred on the screen, and
// the loader fades rather than pulsing radially.
test('mobile fades out the loader without a radial pulse', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	const loader = page.locator('[data-site-loader]');
	const aperture = page.locator('[data-circle-aperture]');
	await expect(page.locator('[data-scene-cover]')).toHaveCSS('display', 'none');
	await expect(aperture).toHaveAttribute('cx', '195');
	await expect(aperture).toHaveAttribute('cy', '422');
	await expect.poll(() => loader.evaluate(element => Number(getComputedStyle(element).opacity))).toBeLessThan(1);
	await expect(page.locator('[data-loader-ring]')).toHaveCSS('box-shadow', 'none');
	await expect(loader).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
	const radius = Number(await aperture.getAttribute('r'));
	expect(radius).toBe(0);
	await expect(page.locator('[data-loader-ring]')).toHaveCSS('opacity', '0');
	await expect(page.locator('header')).toHaveAttribute('data-header-entrance', 'complete');
});

// Protects the desktop homepage loader: the logo stays small, the wave outro reveals the hero through the scene
// cover, then the header and hero content enter in order.
test('homepage restores its wave while other routes keep their fade', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/');
	const loader = page.locator('[data-site-loader]');
	await expect(loader).toBeVisible();
	const header = page.locator('header');

	// Header waits behind the loader
	await expect(header).toHaveAttribute('data-header-entrance', 'waiting');
	await expect(header).toBeHidden();
	await expect(page.locator('main [data-site-loader]')).toHaveCount(0);
	const mark = page.locator('[data-loader-mark]');
	const bounds = await mark.boundingBox();
	if (!bounds) throw new Error('Missing loader logo');
	expect(bounds.width).toBeLessThanOrEqual(120);

	// Wave outro: the aperture and the cover reveal radius both grow
	await expect(loader).toHaveAttribute('data-outro', 'wave');
	await expect(loader).toHaveAttribute('data-webgl-reveal', 'true', { timeout: 8000 });
	await expect(page.locator('[data-loader-ring]')).toHaveCSS('display', 'none');
	await expect(loader.locator(':scope > svg')).toHaveCSS('display', 'none');
	await expect
		.poll(() => page.locator('[data-circle-aperture]').evaluate(el => Number(el.getAttribute('r'))))
		.toBeGreaterThan(0);
	await expect
		.poll(() =>
			page
				.locator('[data-scene-cover]')
				.evaluate(el => Number.parseFloat((el as HTMLElement).style.getPropertyValue('--reveal-radius')))
		)
		.toBeGreaterThan(0);
	await expect(mark).toHaveCSS('transform', 'none');

	// Finished: header and hero enter, and a resize afterwards does not bring the loader back
	await expect(loader).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
	await expect(loader).toBeHidden();
	await expect(header).toHaveAttribute('data-header-entrance', 'complete');
	await expect(header).toBeVisible();
	await expect(header).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete', { timeout: 10000 });
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(loader).toBeHidden();
	await expect(header).toHaveAttribute('data-header-entrance', 'complete');
	expect(errors).toEqual([]);
});

// Protects retired URLs: the old ?loaderConcepts preview shows no chooser, and reduced motion still completes.
test('old preview URL has no chooser and reduced motion completes', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/?loaderConcepts');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
	await expect(page.getByRole('complementary', { name: 'Global loader concepts' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Replay concept' })).toHaveCount(0);
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete');
	await expect(page.locator('header')).toHaveAttribute('data-header-entrance', 'complete');
});

// Protects against a stuck loader when the first image fails: the CSS fail-open (9s) uncovers the page,
// and the homepage's scene deadline (HOMEPAGE_SCENE_DEADLINE_MS, 15s since 99a77b3 so slow hero textures
// still get the WebGL wave) then completes the loader without the WebGL scene.
test('failed first-view image cannot trap the loader', async ({ page }) => {
	await page.route('**/_next/image/**', route => route.abort());
	await page.goto('/');
	const loader = page.locator('[data-site-loader]');
	await expect(loader).toBeHidden({ timeout: LOADER_FAIL_OPEN_MS + EXPECT_SLACK_MS });
	await expect(loader).toHaveAttribute('data-complete', 'true', {
		timeout: HOMEPAGE_SCENE_DEADLINE_MS + LOADER_INTRO_AND_WAVE_MS + EXPECT_SLACK_MS,
	});
	await expect(loader).not.toHaveAttribute('data-webgl-reveal', 'true');
	await expect(page.locator('header')).toHaveAttribute('data-header-entrance', 'complete');
});

// Protects the first paint: before any script runs the loader is already opaque, so the page never flashes.
test('loader has an opaque first paint before hydration', async ({ page }) => {
	await page.route('**/*.js*', route => route.abort());
	await page.goto('/projects/pocketchange/', { waitUntil: 'domcontentloaded' });
	const loader = page.locator('[data-site-loader]');
	await expect(loader).toBeVisible();
	await expect(loader).toHaveCSS('background-color', /^rgb\(/);
	await expect(loader).not.toHaveAttribute('data-revealing', 'true');
});

// Protects the pre-hydration cover: a fixed dark layer above everything, from CSS alone, before the stylesheets load.
test('document cover protects the hero even before stylesheets load', async ({ page }) => {
	await page.route(/\.(js|css)(\?|$)/, route => route.abort());
	await page.goto('/projects/pocketchange/', { waitUntil: 'domcontentloaded' });
	const cover = await page.locator('html').evaluate(el => {
		const css = getComputedStyle(el, '::before');
		return {
			background: css.backgroundColor,
			position: css.position,
			zIndex: css.zIndex,
			visibility: css.visibility,
		};
	});
	expect(cover).toEqual({
		background: 'rgb(18, 18, 18)',
		position: 'fixed',
		zIndex: '2147483646',
		visibility: 'visible',
	});
});

// Protects visitors without JavaScript: the loader never covers the page.
test('JavaScript-disabled visitors are not covered by the loader', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto(test.info().project.use.baseURL || 'http://localhost:3000');
	await expect(page.locator('[data-site-loader]')).toBeHidden();
	await context.close();
});
