import { expect, test } from './helpers/test';

test('header gaps pass through to the hero and navigation remains clickable', async ({ page }) => {
	await page.goto('/projects/pocketchange/');
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	await expect(page.locator('[data-project-water]')).toHaveAttribute('data-ready', 'true');
	await expect(page.locator('header')).toHaveCSS('pointer-events', 'none');
	await expect(page.locator('header a').first()).toHaveCSS('pointer-events', 'auto');
	expect(
		await page.evaluate(() => !!document.elementFromPoint(innerWidth / 2, 50)?.closest('[data-project-hero]'))
	).toBe(true);
	await page.mouse.move(400, 45);
	await page.mouse.move(1000, 45, { steps: 20 });
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page).toHaveURL(/\/projects\/?$/);
});

test('header movement reaches the projects canvas including over links', async ({ page }) => {
	await page.goto('/projects/');
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	const frame = page.locator('iframe[title="Interactive projects"]');
	await expect(frame).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
	expect(await page.evaluate(() => document.elementFromPoint(innerWidth / 2, 50)?.tagName)).toBe('IFRAME');
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
