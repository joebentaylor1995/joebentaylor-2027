import { expect, test } from '@playwright/test';

for (const source of ['/', '/projects/pocketchange/']) {
	test(`projects catalogue warms after the introduction on ${source}`, async ({ page }) => {
		await page.emulateMedia({ reducedMotion: 'reduce' });
		let catalogRequests = 0;
		page.on('request', request => {
			if (new URL(request.url()).pathname === '/api/projects-ribbon/' && !new URL(request.url()).search)
				catalogRequests++;
		});
		await page.goto(source);
		await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true');
		await expect.poll(() => catalogRequests).toBe(1);
		await expect.poll(() => page.locator('link[rel="preload"][href*="/projects-ribbon/app.js"]').count()).toBe(1);
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('iframe[title="Interactive projects"]')).toHaveAttribute('data-ribbon-ready', 'true');
		const renderer = page.frames().find(frame => frame.url().includes('/projects-ribbon/index.html'));
		if (!renderer) throw new Error('Projects was not prepared in the background');
		const originalDocument = await renderer.evaluate(() => performance.timeOrigin);
		await page.getByRole('link', { name: 'Projects', exact: true }).click();
		await expect(page).toHaveURL(/\/projects\/$/);
		const ribbon = page.frameLocator('iframe[title="Interactive projects"]');
		await expect(ribbon.locator('#error')).toBeHidden({ timeout: 30_000 });
		await expect(ribbon.locator('#stage')).toBeVisible();
		expect(catalogRequests).toBe(1);
		await page.getByRole('link', { name: 'Go to home page' }).click();
		await page.getByRole('link', { name: 'Projects', exact: true }).click();
		expect(await renderer.evaluate(() => performance.timeOrigin)).toBe(originalDocument);
		expect(catalogRequests).toBe(1);
	});
}
