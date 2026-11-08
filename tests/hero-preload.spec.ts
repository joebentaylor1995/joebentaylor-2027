// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects the preload: the portrait is fetched once, using the same optimised URL the page displays,
// at the right quality for the device (75 on phones, 90 on desktop).
for (const width of [390, 1440]) {
	test(`hero preload reuses the displayed portrait at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 844 });
		// Every optimised-image request for the portrait that downloaded a body. The hero's texture
		// decoder re-reads the displayed file from the HTTP cache, which transfers nothing.
		const portraits: Promise<string | null>[] = [];
		page.on('requestfinished', request => {
			const url = new URL(request.url());
			if (url.pathname === '/_next/image/' && url.searchParams.get('url') === '/images/hero-depth/portrait.png')
				portraits.push(
					request.sizes().then(({ responseBodySize }) => (responseBodySize > 0 ? request.url() : null))
				);
		});
		await page.goto('/');
		await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete', {
			timeout: 20000,
		});
		const portrait = page.getByTestId('hero-depth').locator('picture img');
		const source = await portrait.evaluate((image: HTMLImageElement) => image.currentSrc);
		expect((await Promise.all(portraits)).filter(Boolean)).toEqual([source]);
		expect(new URL(source).searchParams.get('q')).toBe(width === 390 ? '75' : '90');
		await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true');
	});
}
