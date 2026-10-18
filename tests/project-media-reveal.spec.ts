import { expect, test } from '@playwright/test';

for (const width of [440, 1440]) {
	test(`media reveal scrubs and reverses at ${width}px`, async ({ page }) => {
		await page.addInitScript(() => {
			const draw = WebGLRenderingContext.prototype.drawArrays;
			WebGLRenderingContext.prototype.drawArrays = function (mode, first, count) {
				const surface = this.canvas as HTMLCanvasElement;
				if (surface.hasAttribute('data-media-reveal')) {
					surface.dataset.testDraws = String(Number(surface.dataset.testDraws || 0) + 1);
					surface.dataset.testVertices = String(count);
				}
				return draw.call(this, mode, first, count);
			};
		});
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/pocketchange/?mediaSettings');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
		const canvas = page.locator('[data-media-reveal]');
		const tile = page.locator('[data-media-tile]').first();
		const move = async (progress: number) => {
			const scroll = await tile.evaluate((e, p) => {
				const scroller = document.querySelector('#page .lenis');
				const content = document.querySelector('[data-project-panel-content]');
				const hero = document.querySelector('[data-project-hero-layer]');
				if (!scroller || !content || !hero) throw new Error('Missing project layout');
				const rect = e.getBoundingClientRect();
				const target = innerHeight - p * innerHeight * 0.3;
				return document.querySelector('[data-project-experience]')?.getAttribute('data-enhanced') === 'true'
					? Math.max(0, hero.clientHeight - innerHeight) +
							innerHeight * 0.9 +
							rect.top -
							content.getBoundingClientRect().top -
							target
					: scroller.scrollTop + rect.top - target;
			}, progress);
			await page
				.locator('#page .lenis')
				.first()
				.evaluate((e, y) => e.scrollTo({ top: y, behavior: 'instant' }), scroll);
			await expect
				.poll(() => tile.getAttribute('data-reveal-progress').then(Number))
				.toBeCloseTo(Math.min(1, progress), 1);
		};
		await move(0.3);
		await expect(canvas).toHaveAttribute('data-reveal-ready', 'true');
		await expect(tile).toHaveAttribute('data-revealing', 'true');
		await page.screenshot({ path: `test-results/media-bend-${width}.png` });
		await move(0.65);
		await page.screenshot({ path: `test-results/media-bend-mid-${width}.png` });
		await expect(canvas).toHaveAttribute('data-test-vertices', '6');
		const idleDraws = await canvas.getAttribute('data-test-draws');
		// Observe a stationary interval: static media must not keep drawing.
		await page.waitForTimeout(300);
		await expect(canvas).toHaveAttribute('data-test-draws', idleDraws ?? '');
		await expect(page.getByRole('complementary', { name: 'Media reveal settings' })).toHaveCount(0);
		await move(1.1);
		await expect(tile).not.toHaveAttribute('data-revealing', 'true');
		await expect(tile.locator('figure')).toHaveCSS('opacity', '1');
		await move(0.3);
		await expect(tile).toHaveAttribute('data-revealing', 'true');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(tile).not.toHaveAttribute('data-revealing', 'true');
		await expect(tile.locator('figure')).toHaveCSS('opacity', '1');
	});
}
