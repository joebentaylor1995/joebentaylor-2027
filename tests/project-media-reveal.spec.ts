import { expect, test } from './helpers/test';

for (const width of [440, 1440]) {
	test(`media reveals once on entry and stays revealed at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
		const gallery = page.locator('[data-project-case-builder]');
		await expect(gallery.locator('canvas')).toHaveCount(0);
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
		};
		await move(-0.5);
		await expect(gallery).toHaveAttribute('data-reveal-ready', 'true');
		await expect(tile).not.toHaveAttribute('data-reveal-complete', 'true');
		await move(0.3);
		// No further scroll: the timed reveal must finish on its own.
		await expect(tile).toHaveAttribute('data-reveal-complete', 'true', { timeout: 2000 });
		await expect(tile).not.toHaveAttribute('data-revealing', 'true');
		await expect(tile.locator('figure')).toHaveCSS('clip-path', 'none');
		expect(await tile.locator('figure').evaluate(element => element.getAnimations().length)).toBe(0);
		await expect(page.getByRole('complementary', { name: 'Media reveal settings' })).toHaveCount(0);
		await expect(tile.locator('figure')).toHaveCSS('opacity', '1');
		await move(-1);
		await move(0.3);
		await expect(tile).toHaveAttribute('data-reveal-complete', 'true');
		await expect(tile).not.toHaveAttribute('data-revealing', 'true');
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await expect(tile).not.toHaveAttribute('data-revealing', 'true');
		await expect(tile.locator('figure')).toHaveCSS('opacity', '1');
	});
}
