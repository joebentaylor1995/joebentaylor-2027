import { expect, test } from './helpers/test';

test('overview words, bottom heading and fitted cursor targets', async ({ page }) => {
	await page.goto('/projects/pocketchange/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-loader-overlay]')).toBeHidden({ timeout: 15000 });
	const scroller = page.locator('#page .lenis').first();
	const goTo = async (selector: string, y = 160) => {
		const top = await page.locator(selector).evaluate((el, desiredY) => {
			const content = document.querySelector('[data-project-panel-content]') as HTMLElement;
			const hero = document.querySelector('[data-project-hero-layer]') as HTMLElement;
			return (
				hero.clientHeight -
				innerHeight +
				innerHeight * 0.9 +
				el.getBoundingClientRect().top -
				content.getBoundingClientRect().top -
				desiredY
			);
		}, y);
		await scroller.evaluate((el, value) => el.scrollTo({ top: value, behavior: 'instant' }), top);
	};
	await goTo('[data-objectives-layout]', 0);
	const words = page.locator('[data-objectives-layout] [data-reveal-variant="words"]').first();
	await expect(words).toHaveAttribute('data-wave-state', 'complete');
	const label = page.locator('[data-objectives-label]');
	await expect.poll(() => label.evaluate(el => innerHeight - el.getBoundingClientRect().bottom)).toBeCloseTo(40, 0);
	await goTo('[data-objectives-layout] img[data-cursor-fit]', 300);
	const credit = page.locator('[data-objectives-layout] img[data-cursor-fit]').first();
	await credit.hover();
	await expect(page.locator('[data-cursor="sticky"]')).toHaveCount(1);
	const button = page.getByRole('link', { name: /View Website/ });
	await goTo('[data-button-050]', 400);
	await button.hover();
	await expect(page.locator('[data-cursor="sticky"]')).toHaveCount(1);
	const width = await button.evaluate(el => el.getBoundingClientRect().width);
	await expect
		.poll(() =>
			page
				.locator('[style*="--cursor-fit-width"]')
				.evaluate(el => Number.parseFloat((el as HTMLElement).style.getPropertyValue('--cursor-fit-width')))
		)
		.toBeCloseTo(width, 0);
	const shape = page.locator('[class*="cursorShape"]');
	await expect
		.poll(async () => {
			const cursor = await shape.boundingBox();
			const target = await button.boundingBox();
			if (!cursor || !target) return 1000;
			return Math.max(
				Math.abs(cursor.x - target.x),
				Math.abs(cursor.y - target.y),
				Math.abs(cursor.width - target.width),
				Math.abs(cursor.height - target.height)
			);
		})
		.toBeLessThan(2);
	await page.screenshot({ path: 'test-results/project-overview-motion.png' });
});
