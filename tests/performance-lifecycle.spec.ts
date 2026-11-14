// Imports
// ------------
import { expect, test } from '@playwright/test';

// Constants
// ------------
// NOTE • The awards spiral uploads every CMS poster (50+) one per GPU-paced task before it reports
// ready (afb8ed8): several seconds on a GPU, longer on CI's software WebGL.
const RECOGNITION_READY_TIMEOUT = 30_000;
// The globe only reports ready once its opening journey (globeIntro, 3.2s of frame time) has played,
// on top of building the scene, which leaves too little room in the default 5s on a busy machine.
const GLOBE_READY_TIMEOUT = 15_000;
// Root font size: tablets render rem sizes at 75% (12px, 5439522), everything else at the 10px base
const TABLET_ROOT_FONT_SIZE = 12;
const ROOT_FONT_SIZE = 10;

// Tests
// ------------
// Protects two performance guarantees at each breakpoint: the root type size follows the breakpoint, and
// WebGL sections stop drawing once scrolled out of view.
for (const width of [390, 768, 1024, 1440]) {
	test(`responsive type and off-screen WebGL suspension at ${width}px`, async ({ page }) => {
		// Four WebGL scenes are built one after another; on CI's software WebGL that alone can outrun 60s
		test.slow(!!process.env.CI, 'Builds four WebGL scenes in turn on a software renderer');
		await page.setViewportSize({ width, height: 1000 });
		// Count draw calls per canvas so the test can tell whether a scene is still rendering
		await page.addInitScript(() => {
			const counts = new WeakMap<HTMLCanvasElement, number>();
			Object.assign(window, { webglDrawCounts: counts });
			for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
				for (const method of ['drawArrays', 'drawElements'] as const) {
					const original = context.prototype[method];
					context.prototype[method] = function (...args: number[]) {
						const canvas = this.canvas as HTMLCanvasElement;
						counts.set(canvas, (counts.get(canvas) ?? 0) + 1);
						Reflect.apply(original, this, args);
					};
				}
			}
		});

		// The map gradient image is not fetched until the globe is shown
		await page.goto('/?modalSettings');
		expect(
			await page.evaluate(() =>
				performance
					.getEntriesByType('resource')
					.some(entry => entry.name.includes('/images/map/blue-gradient.png'))
			)
		).toBe(false);

		// Root font size: scaled down at tablet widths, the 10px base elsewhere
		expect(await page.locator('html').evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeCloseTo(
			width >= 700 && width < 1024 ? TABLET_ROOT_FONT_SIZE : ROOT_FONT_SIZE,
			2
		);
		const settings = page.getByRole('complementary', { name: 'Modal settings' });
		const panel = page.locator('#profile-panel');
		// The settings panel opens the profile, which the site loader closes and reopens once it
		// settles, scrolled back to the top: a section shown before then would be scrolled away again
		await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 15000 });
		await expect(panel.locator('..')).toHaveAttribute('data-state', 'open');
		// Total draws across all canvases inside a section
		const count = (selector: string) =>
			page.locator(selector).evaluate(el => {
				const counts = (window as unknown as { webglDrawCounts: WeakMap<HTMLCanvasElement, number> })
					.webglDrawCounts;
				return Array.from(el.querySelectorAll('canvas')).reduce(
					(sum, canvas) => sum + (counts.get(canvas) ?? 0),
					0
				);
			});
		// [settings button, section selector, how long it may take to report ready]
		for (const [button, selector, timeout] of [
			['Show Recognition', '[data-recognition]', RECOGNITION_READY_TIMEOUT],
			['Show rain', '[data-connect]', undefined],
			['Show Design toolkit', '[data-toolkit="Design toolkit" i]', undefined],
			['Show globe', '[data-globe]', GLOBE_READY_TIMEOUT],
		] as const) {
			await settings.getByRole('button', { name: button, exact: true }).click();
			await expect(page.locator(selector)).toHaveAttribute('data-state', 'ready', { timeout });

			// Recognition and Connect animate continuously, so their draw count must still be growing on screen
			await page.waitForTimeout(400);
			if (button === 'Show Recognition' || button === 'Show rain') {
				const before = await count(selector);
				await expect.poll(() => count(selector)).toBeGreaterThan(before);
			}

			// Scroll the Profile panel to the top so the section is off screen, then check that drawing stops
			await panel.evaluate(el => {
				el.scrollTop = 0;
			});
			await page.waitForTimeout(350);
			const paused = await count(selector);
			await page.waitForTimeout(500);
			expect(await count(selector)).toBe(paused);
		}

		// No horizontal overflow in the panel
		expect(await panel.evaluate(el => el.scrollWidth)).toBeLessThanOrEqual(
			await panel.evaluate(el => el.clientWidth)
		);
		// Tablet only: the Connect nav is not width-capped
		if (width === 768) {
			await settings.getByRole('button', { name: 'Show rain', exact: true }).click();
			await expect(page.locator('[data-connect] nav')).toHaveCSS('max-width', 'none');
			await page.screenshot({ path: 'test-results/tablet-profile.png' });
		}
	});
}
