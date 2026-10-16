import { expect, test } from '@playwright/test';

test('nearby toolkit prepares before entering the modal viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const panel = page.locator('#profile-panel');
	const toolkit = page.locator('[data-toolkit="Design toolkit"]');
	await expect(panel).toBeVisible();
	await page.waitForTimeout(1200);
	await toolkit.evaluate(element => {
		const scroller = element.closest('#profile-panel');
		if (!scroller) throw new Error('Missing profile scroller');
		scroller.scrollTop += element.getBoundingClientRect().top - scroller.getBoundingClientRect().bottom - 100;
	});
	await expect(toolkit).toHaveAttribute('data-state', 'ready', { timeout: 15000 });
	const bounds = await toolkit.boundingBox();
	const viewport = await panel.boundingBox();
	if (!bounds || !viewport) throw new Error('Missing scene bounds');
	expect(bounds.y).toBeGreaterThan(viewport.y + viewport.height);
	await expect(toolkit.locator('canvas')).toHaveCount(1);
});
