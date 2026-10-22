import { expect, test } from './helpers/test';

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test('mobile hero keeps the header above the scene after loading and navigation', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-liquid-ready="true"]')).toBeVisible({ timeout: 30000 });
	const header = page.locator('header[data-tone]');
	await expect(header).toHaveAttribute('data-header-entrance', 'complete', { timeout: 20000 });
	await expect(page.locator('[data-scene-cover]')).toHaveAttribute('data-complete', 'true');
	const checkHeader = async () => {
		await expect(header).toHaveCSS('opacity', '1');
		await expect
			.poll(() =>
				header.evaluate(element => {
					const logo = element.querySelector('svg');
					if (!logo) return false;
					const box = logo.getBoundingClientRect();
					return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
				})
			)
			.toBe(true);
	};
	await checkHeader();
	// A CSS scrim over the canvas would darken its rasterised white text too.
	await expect
		.poll(() =>
			page.locator('[data-liquid-ready="true"]').evaluate(element => getComputedStyle(element, '::after').content)
		)
		.toBe('none');
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.setViewportSize({ width: 390, height: 844 });
	await checkHeader();
	await page.goto('/cookies/');
	await page.getByRole('link', { name: 'Go to home page', exact: true }).click();
	await expect(page.locator('[data-scene-cover]')).toHaveAttribute('data-complete', 'true', { timeout: 20000 });
	await checkHeader();
});
