import { expect, test } from '@playwright/test';

test('project title hands over to water, responds to the pointer and respects reduced motion', async ({ page }) => {
	await page.goto('/projects/pocketchange/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
	const canvas = page.locator('[data-project-water]');
	await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
	await expect(canvas).toHaveAttribute('data-intro', 'complete');
	const layers = await page.locator('#project-title').evaluate(title => {
		const titleLayer = title.closest('[data-project-hero]')?.querySelector('[data-page-title-reveal]')
			?.parentElement?.parentElement?.parentElement;
		const water = document.querySelector('[data-project-water]');
		return {
			title: titleLayer ? Number(getComputedStyle(titleLayer).zIndex) : 0,
			water: water ? Number(getComputedStyle(water).zIndex) : 0,
		};
	});
	expect(layers.title).toBeGreaterThan(layers.water);
	await expect(page.locator('[data-project-hero]')).toHaveAttribute('data-water-text', 'true');
	await expect(page.locator('#project-title [data-page-title-reveal]')).toHaveAttribute(
		'data-reveal-variant',
		'block'
	);
	await expect(page.locator('#project-title [data-page-title-reveal]')).toHaveAttribute(
		'data-wave-state',
		'complete'
	);
	await expect(page.locator('#project-title [data-page-title-reveal]')).toHaveCSS(
		'-webkit-text-fill-color',
		'rgba(0, 0, 0, 0)'
	);
	await expect(page.locator('[data-project-hero] p')).toHaveCSS('-webkit-text-fill-color', 'rgba(0, 0, 0, 0)');
	const resting = await page.screenshot({ clip: { x: 100, y: 200, width: 1000, height: 400 } });
	await page.mouse.move(200, 300);
	await page.mouse.move(1000, 450, { steps: 25 });
	const moving = await page.screenshot({ clip: { x: 100, y: 200, width: 1000, height: 400 } });
	expect(moving.equals(resting)).toBe(false);
	await page.screenshot({ path: 'test-results/project-water-desktop.png' });
	await page
		.locator('#page .lenis')
		.first()
		.evaluate(el => el.scrollTo({ top: 280, behavior: 'instant' }));
	await expect
		.poll(() =>
			page.locator('[data-project-hero-layer]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).f)
		)
		.toBeCloseTo(-280, 0);
	await page.screenshot({ path: 'test-results/project-water-text.png' });
	await page.setViewportSize({ width: 440, height: 780 });
	await expect(canvas).toHaveAttribute('data-ready', 'true');
	await expect(canvas).toHaveAttribute('data-intro', 'complete');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(canvas).not.toHaveAttribute('data-ready');
	await expect(page.locator('[data-project-hero]')).not.toHaveAttribute('data-water-text');
	await expect(page.locator('#project-title')).not.toHaveCSS('-webkit-text-fill-color', 'rgba(0, 0, 0, 0)');
	await expect(page.locator('[data-project-hero] img')).toBeVisible();
});
