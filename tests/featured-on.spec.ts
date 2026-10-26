import { expect, test } from './helpers/test';

for (const width of [1440, 440]) {
	test(`Codrops background plays only while visible at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const videoRequests: string[] = [];
		page.on('request', request => {
			if (request.url().includes('/videos/codrops.mp4')) videoRequests.push(request.url());
		});
		await page.goto('/');
		const video = page.locator('[data-featured-video]').first();
		await expect(video).not.toHaveAttribute('src');
		expect(videoRequests).toEqual([]);
		await expect(video).toHaveJSProperty('paused', true);
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await video.scrollIntoViewIfNeeded();
		await expect(video).toHaveCSS('object-fit', 'cover');
		await expect(video).toHaveJSProperty('muted', true);
		await expect(video).toHaveJSProperty('loop', false);
		await expect(video).toHaveJSProperty('paused', false);
		await expect
			.poll(() => video.evaluate(element => (element as HTMLVideoElement).currentTime))
			.toBeGreaterThan(0);
		const geometry = await video.evaluate(element => ({
			video: element.getBoundingClientRect().toJSON(),
			card: element.parentElement?.getBoundingClientRect().toJSON(),
		}));
		expect(geometry.video.width).toBeCloseTo(geometry.card.width * 1.01, 2);
		expect(geometry.video.height).toBeCloseTo(geometry.card.height * 1.01, 2);
		await page.screenshot({ path: `test-results/featured-on-${width}.png` });
		await page.getByRole('dialog', { name: 'Profile', exact: true }).evaluate(element => {
			element.scrollTop = 0;
		});
		await expect(video).toHaveJSProperty('paused', true);
		await video.scrollIntoViewIfNeeded();
		await expect(video).toHaveJSProperty('paused', false);
		const alternate = page.locator('[data-featured-video]').nth(1);
		await video.evaluate(element => {
			const media = element as HTMLVideoElement;
			media.currentTime = media.duration - 0.9;
		});
		await expect(alternate).toHaveJSProperty('paused', false);
		await expect
			.poll(() => alternate.evaluate(element => Number(getComputedStyle(element).opacity)))
			.toBeGreaterThan(0);
		await expect(alternate).toHaveCSS('opacity', '1');
		await expect(video).toHaveJSProperty('paused', true);
		await alternate.evaluate(element => {
			const media = element as HTMLVideoElement;
			media.currentTime = media.duration - 0.9;
		});
		await expect(video).toHaveCSS('opacity', '1');
		await expect(alternate).toHaveJSProperty('paused', true);
		await page.getByRole('button', { name: 'Close profile', exact: true }).press('Escape');
		await expect(video).toHaveJSProperty('paused', true);
		await expect(alternate).not.toHaveAttribute('src');
		await expect(alternate).toHaveJSProperty('currentTime', 0);
		await expect(video).not.toHaveAttribute('src');
		await expect(video).toHaveJSProperty('currentTime', 0);
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await expect(video).toHaveAttribute('src', '/videos/codrops.mp4');
		await expect(video).toHaveJSProperty('currentTime', 0);
		await video.scrollIntoViewIfNeeded();
		await expect(video).toHaveJSProperty('paused', false);
	});
}
