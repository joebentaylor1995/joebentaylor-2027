// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the cinematic loader fade on a case study: the loader fades once the logo has landed while
// the hero scale settles slowly. Uses the ?loaderTweaks timeline slider to jump to exact times.
test('cinematic fade starts immediately after the logo while the hero settles slowly', async ({ page }) => {
	await page.goto('/projects/pocketchange/?loaderTweaks');
	const loader = page.locator('[data-site-loader]');
	const hero = page.locator('[data-project-hero]');
	const mark = page.locator('[data-loader-mark]');
	await expect(loader).toHaveAttribute('data-complete', 'true', { timeout: 10000 });
	const scrub = page.getByRole('slider', { name: 'Scrub timeline' });
	// Moves the scrub slider to a time in seconds. The value is set through the native setter so the
	// framework sees a real input event.
	const seek = async (value: string) =>
		scrub.evaluate((el, next) => {
			Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(el, next);
			el.dispatchEvent(new Event('input', { bubbles: true }));
		}, value);

	// Defaults
	await expect(page.getByRole('combobox', { name: 'Reveal effect' })).toHaveValue('fade');
	await expect(page.getByRole('slider', { name: 'Hero starting scale' })).toHaveValue('1.2');

	// 1.7s: logo still showing, hero at its starting scale
	await seek('1.7');
	await expect(hero).toHaveCSS('--project-intro-scale', '1.2');
	await expect(loader).toHaveCSS('opacity', '1');
	await expect(mark).toHaveCSS('opacity', '1');

	// 1.8s: loader is part-way faded but the logo mark is still opaque
	await seek('1.8');
	const opacity = await loader.evaluate(el => Number(getComputedStyle(el).opacity));
	expect(opacity).toBeGreaterThan(0);
	expect(opacity).toBeLessThan(1);
	await expect(mark).toHaveCSS('opacity', '1');
	await expect(page.locator('[data-window-aperture]')).toHaveAttribute('width', '0');

	// 1.925s: half way through the fade
	await seek('1.925');
	expect(await loader.evaluate(el => Number(getComputedStyle(el).opacity))).toBeCloseTo(0.5, 1);
	await page.screenshot({ path: 'test-results/loader-cinematic-fade.png' });

	// 2.15s: loader gone while the hero is still settling above scale 1
	await seek('2.15');
	await expect(loader).toHaveCSS('opacity', '0');
	expect(
		await hero.evaluate(el => Number((el as HTMLElement).style.getPropertyValue('--project-intro-scale')))
	).toBeGreaterThan(1);

	// 5.7s: timeline over, hero scale style removed and the page is not transformed
	await seek('5.7');
	await expect(hero).not.toHaveAttribute('style', /--project-intro-scale/);
	await expect(page.locator('#page')).toHaveCSS('transform', 'none');

	// Replay runs the whole thing to completion
	await page.getByRole('button', { name: 'Replay', exact: true }).click();
	await expect(loader).toHaveAttribute('data-complete', 'true', { timeout: 8000 });
	await expect(page.locator('h1 [data-page-title-reveal]')).toHaveAttribute('data-wave-state', 'complete');
	await expect(hero).not.toHaveAttribute('style', /--project-intro-scale/, { timeout: 8000 });
});

// Protects the real (unscrubbed) timing: the loader finishes between 100ms and 900ms after the logo lands.
test('a fresh project load fades out promptly after the logo lands', async ({ page }) => {
	// Record when the loader lands and settles, as plain script so it is ready before the app runs
	await page.addInitScript(
		`window.loaderTimes = {}; for (const name of ['site-loader:landed', 'site-loader:settled']) window.addEventListener(name, () => window.loaderTimes[name] = performance.now());`
	);
	await page.goto('/projects/pocketchange/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 10000 });
	const elapsed = await page.evaluate<number>(
		`window.loaderTimes['site-loader:settled'] - window.loaderTimes['site-loader:landed']`
	);
	expect(elapsed).toBeGreaterThan(100);
	expect(elapsed).toBeLessThan(900);
	await expect(page.locator('h1 [data-page-title-reveal]')).toHaveAttribute('data-wave-state', 'complete');
});
