import { expect, test } from '@playwright/test';

test('legal header returns to dark on client navigation home and stays correct on back', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	for (const route of ['/cookies/', '/terms-privacy/', '/llms/']) {
		await page.goto(route);
		const home = page.getByRole('link', { name: 'Go to home page', exact: true });
		const logo = home.locator('svg');
		const profile = page.getByRole('button', { name: 'Open Profile', exact: true });
		await expect(logo).toHaveCSS('fill', 'rgb(255, 255, 255)');
		await expect(profile).toHaveCSS('color', 'rgb(255, 255, 255)');
		await home.click();
		await expect(page).toHaveURL(/:\d+\/$/);
		await expect(logo).toHaveCSS('fill', 'rgb(18, 18, 18)');
		await expect(profile).toHaveCSS('color', 'rgb(18, 18, 18)');
		await page.goBack();
		await expect(logo).toHaveCSS('fill', 'rgb(255, 255, 255)');
		await expect(profile).toHaveCSS('color', 'rgb(255, 255, 255)');
	}
});
