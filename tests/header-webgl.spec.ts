// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects pointer pass-through on the header: empty header space lets the pointer reach the
// hero beneath while the nav links stay clickable.
test('header gaps pass through to the hero and navigation remains clickable', async ({ page }) => {
	await page.goto('/projects/pocketchange/');
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	await expect(page.locator('[data-project-water]')).toHaveAttribute('data-ready', 'true');
	// The header ignores the pointer except on its links
	await expect(page.locator('header')).toHaveCSS('pointer-events', 'none');
	await expect(page.locator('header a').first()).toHaveCSS('pointer-events', 'auto');
	// Hit-testing at the header's empty centre lands on the hero, not the header
	expect(
		await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, 50)?.closest('[data-project-hero]'))
	).toBe(true);
	// Sweep the pointer across the header before clicking, as a real user would
	await page.mouse.move(400, 45);
	await page.mouse.move(1000, 45, { steps: 20 });
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page).toHaveURL(/\/projects\/?$/);
});

// Protects pointer movement over the header reaching the interactive projects canvas, which lives in
// an iframe, including when the pointer is over a nav link.
test('header movement reaches the projects canvas including over links', async ({ page }) => {
	await page.goto('/projects/');
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	const frame = page.locator('iframe[title="Interactive projects"]');
	await expect(frame).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
	expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, 50)?.tagName)).toBe('IFRAME');
	// Mark the canvas the first time it receives a pointermove
	await frame.evaluate((el: HTMLIFrameElement) => {
		const canvas = el.contentDocument?.querySelector('canvas');
		canvas?.addEventListener(
			'pointermove',
			() => {
				canvas.setAttribute('data-header-pointer-received', 'true');
			},
			{ once: true }
		);
	});
	await page.getByRole('link', { name: 'Projects', exact: true }).hover();
	await expect(page.frameLocator('iframe[title="Interactive projects"]').locator('canvas')).toHaveAttribute(
		'data-header-pointer-received',
		'true'
	);
});
