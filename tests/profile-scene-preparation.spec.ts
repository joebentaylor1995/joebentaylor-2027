import { expect, test } from './helpers/test';

test('recognition prepares a complete frame before entering view without showing fallback posters', async ({
	page,
}) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const section = page.locator('[data-recognition]');
	await expect(section.locator('canvas')).toHaveCSS('opacity', '0');
	await expect(section.locator('img').first()).toBeHidden();
	await section.evaluate(element => {
		const panel = element.closest('#profile-panel');
		if (!panel) throw new Error('Missing profile panel');
		panel.scrollTop +=
			element.getBoundingClientRect().top - panel.getBoundingClientRect().bottom - panel.clientHeight;
	});
	await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 20000 });
	await expect(section).toHaveAttribute('data-visible', 'false');
	// Written during rendering, so readiness guarantees layout and a first frame.
	await expect(section).toHaveAttribute('data-award-size', '85');
	await expect(section.locator('canvas')).toHaveCSS('opacity', '1');
	await expect(section.locator('img').first()).toBeHidden();
});

test('nearby toolkit prepares before entering the modal viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const panel = page.locator('#profile-panel');
	const toolkit = page.locator('[data-toolkit="Design toolkit" i]');
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
