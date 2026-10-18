import { expect, test } from '@playwright/test';

test('navigation reveals the destination and header together through the lens', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/projects/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.frameLocator('iframe[title="Interactive projects"]').locator('#stage')).toBeVisible();
	expect(
		page
			.frames()
			.find(frame => frame.url().includes('/projects-ribbon/index.html'))
			?.url()
	).not.toContain('entrance=cascade');
	await page.getByRole('link', { name: 'Go to home page' }).click();
	await page.waitForFunction(() => document.documentElement.dataset.navigationWave === 'running');
	const captured = await page.evaluate(() => ({
		mask: getComputedStyle(document.documentElement, '::view-transition-new(navigation-surface)').maskImage,
		filter: getComputedStyle(document.documentElement, '::view-transition-new(navigation-surface)').filter,
		header: document.querySelector('header')?.style.viewTransitionName,
		fades: document.getAnimations().filter(a => a instanceof CSSAnimation && a.animationName === 'vt-fade').length,
	}));
	expect(captured.mask).toContain('radial-gradient');
	expect(captured.filter).toContain('navigation-wave-lens');
	expect(captured.header || '').not.toContain('site-header');
	expect(captured.fades).toBe(0);
	await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave', 'running');
	await expect(page.locator('header')).toHaveAttribute('data-tone', 'dark');
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await page.waitForFunction(() => document.documentElement.dataset.navigationWave === 'running');
	await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave', 'running');
	await expect(page.locator('header')).toHaveAttribute('data-tone', 'light');
	const ribbon = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(ribbon.locator('#intro-status')).toContainText('Ready. Replay', { timeout: 15000 });
	expect(
		page
			.frames()
			.find(frame => frame.url().includes('/projects-ribbon/index.html'))
			?.url()
	).toContain('entrance=cascade');
	await expect(ribbon.locator('#intro-effect')).toHaveCount(0);
	await ribbon.locator('#intro-replay').evaluate((button: HTMLButtonElement) => button.click());
	await expect(ribbon.locator('#intro-status')).toContainText('Playing');
	// Next's history restore does not issue the same snapshot callback as link navigation.
	await page.goBack();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave', 'running');
	expect(errors).toEqual([]);
});

test('mobile navigation completes and reduced motion bypasses the wave', async ({ page }) => {
	await page.setViewportSize({ width: 440, height: 780 });
	await page.goto('/projects/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	await page.getByRole('link', { name: 'Go to home page' }).click();
	await page.waitForFunction(() => document.documentElement.dataset.navigationWave === 'running');
	await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave', 'running');
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page).toHaveURL(/\/projects\/$/);
	await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave', 'running');
});
