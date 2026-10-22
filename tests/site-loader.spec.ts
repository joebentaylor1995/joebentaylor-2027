import { expect, test } from './helpers/test';

for (const route of ['/projects/pocketchange/', '/projects/', '/cookies']) {
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
		if (route !== '/projects/') {
			const title = page.locator('h1 [data-page-title-reveal]');
			await expect(title).toHaveAttribute('data-wave-state', 'complete');
			await expect(title).toBeVisible();
		}
	});
}

test('mobile project uses the fade outro and block title reveal', async ({ page }) => {
	await page.setViewportSize({ width: 440, height: 780 });
	await page.goto('/projects/pocketchange/');
	const title = page.locator('h1 [data-page-title-reveal]');
	await expect(title).toHaveAttribute('data-wave-state', 'waiting');
	await expect(title).toHaveAttribute('data-reveal-variant', 'block');
	await expect(title.locator('span')).toHaveCSS('opacity', '0');
	await expect(page.locator('[data-circle-aperture]')).toHaveAttribute('r', '0');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true');
	await expect(title).toHaveAttribute('data-wave-state', 'complete');
	await expect(page.locator('[data-project-water]')).toHaveAttribute('data-intro', 'complete');
});

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

test('homepage restores its wave while other routes keep their fade', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/');
	const loader = page.locator('[data-site-loader]');
	await expect(loader).toBeVisible();
	const header = page.locator('header');
	await expect(header).toHaveAttribute('data-header-entrance', 'waiting');
	await expect(header).toBeHidden();
	await expect(page.locator('main [data-site-loader]')).toHaveCount(0);
	const mark = page.locator('[data-loader-mark]');
	const bounds = await mark.boundingBox();
	if (!bounds) throw new Error('Missing loader logo');
	expect(bounds.width).toBeLessThanOrEqual(120);
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

test('old preview URL has no chooser and reduced motion completes', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/?loaderConcepts');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
	await expect(page.getByRole('complementary', { name: 'Global loader concepts' })).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Replay concept' })).toHaveCount(0);
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete');
	await expect(page.locator('header')).toHaveAttribute('data-header-entrance', 'complete');
});

test('failed first-view image cannot trap the loader', async ({ page }) => {
	await page.route('**/_next/image/**', route => route.abort());
	await page.goto('/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
	await expect(page.locator('[data-site-loader]')).toBeHidden();
});

test('loader has an opaque first paint before hydration', async ({ page }) => {
	await page.route('**/*.js*', route => route.abort());
	await page.goto('/projects/pocketchange/', { waitUntil: 'domcontentloaded' });
	const loader = page.locator('[data-site-loader]');
	await expect(loader).toBeVisible();
	await expect(loader).toHaveCSS('background-color', /^rgb\(/);
	await expect(loader).not.toHaveAttribute('data-revealing', 'true');
});

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

test('JavaScript-disabled visitors are not covered by the loader', async ({ browser }) => {
	const context = await browser.newContext({ javaScriptEnabled: false });
	const page = await context.newPage();
	await page.goto(test.info().project.use.baseURL || 'http://localhost:3000');
	await expect(page.locator('[data-site-loader]')).toBeHidden();
	await context.close();
});
