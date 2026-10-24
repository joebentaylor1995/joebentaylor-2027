import { expect, test } from './helpers/test';

test('profile preserves the scrolled case study and restores scrolling on close', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/projects/pocketchange/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	const scroller = page.locator('#page .lenis').first();
	await scroller.evaluate(el => el.scrollTo({ top: 2200, behavior: 'instant' }));
	await expect(page.locator('[data-project-panel]')).toHaveAttribute('data-open', 'true');
	const top = await scroller.evaluate(el => el.scrollTop);
	const stage = page.locator('[data-project-stage]');
	const stageTop = await stage.evaluate(el => el.getBoundingClientRect().top);
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const profile = page.locator('#profile-panel');
	await expect(profile).toHaveCSS('clip-path', 'inset(0px)');
	expect(await scroller.evaluate(el => el.scrollTop)).toBeCloseTo(top, 0);
	await profile.evaluate(el => el.scrollTo({ top: 600, behavior: 'instant' }));
	await expect.poll(() => profile.evaluate(el => el.scrollTop)).toBeGreaterThan(500);
	await page.keyboard.press('Escape');
	await expect(profile).toBeHidden();
	expect(await scroller.evaluate(el => el.scrollTop)).toBeCloseTo(top, 0);
	expect(await stage.evaluate(el => el.getBoundingClientRect().top)).toBeCloseTo(stageTop, 0);
	await page.mouse.move(1100, 600);
	await page.mouse.wheel(0, 400);
	await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBeGreaterThan(top + 100);
});
