import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
	test(`hero preload reuses the displayed portrait at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 844 });
		const portraits: string[] = [];
		page.on('request', request => {
			const url = new URL(request.url());
			if (url.pathname === '/_next/image/' && url.searchParams.get('url') === '/images/hero-depth/portrait.png')
				portraits.push(request.url());
		});
		await page.goto('/');
		await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete', {
			timeout: 20000,
		});
		const portrait = page.getByTestId('hero-depth').locator('picture img');
		const source = await portrait.evaluate((image: HTMLImageElement) => image.currentSrc);
		expect(portraits).toEqual([source]);
		expect(new URL(source).searchParams.get('q')).toBe(width === 390 ? '75' : '90');
		await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true');
	});
}
