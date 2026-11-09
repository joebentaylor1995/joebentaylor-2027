// Imports
// ------------
import { expect, test } from '@playwright/test';

// Constants
// ------------
const LOADER_TIMEOUT = 15_000;

// Tests
// ------------
// Protects the Codrops card video: nothing is fetched until Profile opens, it plays only while
// on screen, hands off to a second video before the first ends, and resets when Profile closes.
for (const width of [1440, 440]) {
	test(`Codrops background plays only while visible at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		// Track every fetch made while Profile is closed, to prove the video is not requested before it is
		// needed. The file is picked per screen from the CMS renditions (4467e15), with /videos/codrops.mp4 as
		// the fallback, so its URL is only known once Profile opens.
		const requestsWhileClosed: string[] = [];
		const requestsAfterOpen: string[] = [];
		let profileOpened = false;
		page.on('request', request => {
			(profileOpened ? requestsAfterOpen : requestsWhileClosed).push(request.url());
		});
		await page.goto('/');
		// NOTE • An Open Profile click that lands as the intro loader settles can be dropped (no /profile/
		// push), so wait for the loader to finish, as a visitor would
		await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', {
			timeout: LOADER_TIMEOUT,
		});

		// Closed: no source attached, not playing
		const video = page.locator('[data-featured-video]').first();
		await expect(video).not.toHaveAttribute('src');
		await expect(video).toHaveJSProperty('paused', true);

		// Open: a source is attached that was never fetched while closed
		profileOpened = true;
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await expect(page.locator('#profile-panel')).toHaveAttribute('aria-hidden', 'false');
		await expect(video).toHaveAttribute('src', /\.mp4$/);
		const source = (await video.getAttribute('src')) ?? '';
		const sourceUrl = new URL(source, page.url()).href;
		expect(requestsWhileClosed).not.toContain(sourceUrl);
		// ...and is fetched now, which also proves the closed check above can see the request
		await expect.poll(() => requestsAfterOpen).toContain(sourceUrl);

		// It plays muted without looping and fills its card with a slight 1% overscan
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

		// Scrolling it out of view pauses it; scrolling back resumes
		await page.getByRole('dialog', { name: 'Profile', exact: true }).evaluate(element => {
			element.scrollTop = 0;
		});
		await expect(video).toHaveJSProperty('paused', true);
		await video.scrollIntoViewIfNeeded();
		await expect(video).toHaveJSProperty('paused', false);

		// Near the end (0.9s left) the second video fades in and takes over from the first
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

		// And the reverse hand-off when the second video nears its end
		await alternate.evaluate(element => {
			const media = element as HTMLVideoElement;
			media.currentTime = media.duration - 0.9;
		});
		await expect(video).toHaveCSS('opacity', '1');
		await expect(alternate).toHaveJSProperty('paused', true);

		// Closing Profile pauses both, unloads their sources and rewinds them
		await page.getByRole('button', { name: 'Close profile', exact: true }).press('Escape');
		await expect(video).toHaveJSProperty('paused', true);
		await expect(alternate).not.toHaveAttribute('src');
		await expect(alternate).toHaveJSProperty('currentTime', 0);
		await expect(video).not.toHaveAttribute('src');
		await expect(video).toHaveJSProperty('currentTime', 0);
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await expect(video).toHaveAttribute('src', source);
		await expect(video).toHaveJSProperty('currentTime', 0);
		await video.scrollIntoViewIfNeeded();
		await expect(video).toHaveJSProperty('paused', false);
	});
}
