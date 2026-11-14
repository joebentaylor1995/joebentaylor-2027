// Imports
// ------------
import { expect, test } from '@playwright/test';

// Helpers
// ------------
// Globals of the standalone ribbon document, declared so the evaluate bodies type-check
declare const introduction: { active: boolean; progress: number };

// Records, frame by frame, whether the ribbon's slide cascade ever plays. Init scripts run in every frame, so this
// only arms itself inside the ribbon document; `introduction` is its top-level binding from app.js.
const WATCH_INTRODUCTION = `
	if (location.pathname.startsWith('/projects-ribbon/')) {
		window.introductionPlayed = false;
		const watch = () => {
			try {
				if (introduction.active) window.introductionPlayed = true;
			} catch {}
			requestAnimationFrame(watch);
		};
		requestAnimationFrame(watch);
	}
`;

// Tests
// ------------
// Protects the Projects entrance order: the page transition owns the entrance and the ribbon arrives at rest, so
// the slide cascade never overlaps it (it only plays on request, from the tuning panel's Replay button).
test('projects page transition plays without the ribbon cascade overlapping it', async ({ page }) => {
	await page.addInitScript(WATCH_INTRODUCTION);
	await page.goto('/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	// Wait until the loader is not pending
	await page.locator('html:not([data-loader-pending])').waitFor();
	await page.locator('header').getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page).toHaveURL(/\/projects\/$/);

	// The ribbon settles at rest, then the page transition finishes
	const frame = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(frame.locator('#stage')).toBeVisible();
	await expect(frame.locator('#intro-status')).toContainText('Ready.', { timeout: 30_000 });
	await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave', 'running');
	const renderer = page.frames().find(item => item.url().includes('/projects-ribbon/'));
	if (!renderer) throw new Error('Missing ribbon frame');

	// The cascade never started on any frame since the ribbon document loaded, and it rests fully revealed
	expect(await renderer.evaluate(() => Reflect.get(window, 'introductionPlayed'))).toBe(false);
	expect(await renderer.evaluate(() => [introduction.active, introduction.progress])).toEqual([false, 1]);
});
