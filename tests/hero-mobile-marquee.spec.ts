import { expect, test } from './helpers/test';

test('mobile marquee stays in HTML while desktop uses WebGL', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await expect(page.locator('[data-liquid-ready="true"]')).toBeVisible({ timeout: 20000 });
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true');
	const marquee = page.locator('[data-logo-marquee]');
	const track = page.locator('[data-logo-track]');
	await expect(marquee).toHaveCSS('opacity', '1');
	await expect(track).toHaveCSS('animation-play-state', 'running');
	const initial = await track.evaluate(element => getComputedStyle(element).transform);
	await expect.poll(() => track.evaluate(element => getComputedStyle(element).transform)).not.toBe(initial);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(track).toHaveCSS('animation-name', 'none');
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.setViewportSize({ width: 1440, height: 900 });
	await expect(marquee).toHaveCSS('opacity', '0');
	await expect(track).toHaveCSS('animation-play-state', 'paused');
});
