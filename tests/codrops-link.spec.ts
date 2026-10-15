import { expect, test } from '@playwright/test';

test('CSSDA Judge shares the external link cursor behaviour', async ({ page }) => {
	await page.goto('/?modalSettings');
	await page.getByRole('button', { name: 'Show globe', exact: true }).click();
	const link = page.getByRole('link', { name: 'CSSDA Judge (opens in a new tab)' });
	await expect(link).toHaveAttribute('href', 'https://www.cssdesignawards.com/judges/joe-taylor/1893/');
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	await link.hover();
	const icon = page.locator('svg[class*="linkCursor"]');
	await expect(icon).toHaveCSS('opacity', '1');
	await expect(icon).toHaveCSS('width', '20px');
	await expect(page.locator('span[class*="cursorShape"]')).toHaveCSS('opacity', '1');
	await page.getByRole('button', { name: 'Close profile', exact: true }).hover();
	await expect(icon).toHaveCSS('opacity', '0');
});

test('Codrops card links externally and fades its cursor icon on hover', async ({ page }) => {
	await page.goto('/?modalSettings');
	await page.getByRole('button', { name: 'Show globe', exact: true }).click();
	const link = page.getByRole('link', { name: 'Featured on Codrops (opens in a new tab)' });
	await expect(link).toHaveAttribute('target', '_blank');
	await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
	await expect(link).toHaveAttribute(
		'href',
		'https://tympanus.net/codrops/2026/05/28/the-never-ending-story-building-a-seamless-infinite-scroll-experience-with-gsap-lenis/'
	);
	await link.hover();
	const cursor = page.locator('svg[class*="linkCursor"]');
	await expect(cursor).toHaveCSS('opacity', '1');
	await expect(page.locator('span[class*="cursorShape"]')).toHaveCSS('opacity', '1');
	await expect(cursor).toHaveCSS('transition-duration', '0.2s');
	await page.getByRole('button', { name: 'Close profile', exact: true }).hover();
	await expect(cursor).toHaveCSS('opacity', '0');
	await link.focus();
	await expect(link).toBeFocused();
});
