import { expect, test } from './helpers/test';

test('modal headings reveal on open and on entering view, replaying each opening', async ({ page }) => {
	await page.goto('/');
	const headings = page.locator('[data-profile-heading-reveal]');
	await expect(headings).toHaveCount(6);
	for (let opening = 0; opening < 2; opening++) {
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await expect(headings.first().locator('span')).toHaveCSS('opacity', '0');
		expect(await headings.first().evaluate(element => getComputedStyle(element, '::after').animationName)).not.toBe(
			'none'
		);
		await expect(headings.first().locator('span')).toHaveCSS('opacity', '1');
		for (const sticky of [headings.nth(1), headings.nth(2), headings.nth(3)]) {
			await expect(sticky.locator('span')).toHaveCSS('opacity', '0');
			await expect(sticky).not.toHaveAttribute('data-revealed');
			await sticky.scrollIntoViewIfNeeded();
			await expect(sticky).toHaveAttribute('data-revealed', 'true');
			await expect(sticky.locator('span')).toHaveCSS('opacity', '1');
			await expect(sticky.locator('..')).toHaveCSS('position', 'sticky');
		}
		await page.getByRole('button', { name: 'Close profile', exact: true }).click();
		await expect(page.locator('#profile-panel')).toHaveAttribute('aria-hidden', 'true');
	}
});

test('reduced motion shows modal headings without a wipe', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	for (const heading of await page.locator('[data-profile-heading-reveal]').all()) {
		await expect(heading.locator('span')).toHaveCSS('opacity', '1');
		expect(await heading.evaluate(element => getComputedStyle(element, '::after').display)).toBe('none');
	}
});
