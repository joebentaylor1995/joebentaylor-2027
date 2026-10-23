// Pages & Headers
// ------------
// NOTE • The 404 page and the security headers from next.config.js — both
// fail quietly when broken, so they're checked here.
import { expect, test } from '@playwright/test';

test('unknown URLs stream the site 404 with noindex and a home action', async ({ page }) => {
	const response = await page.goto('/this-page-does-not-exist/');
	// Next commits the shared shell before the dynamic catch-all calls notFound().
	// Retaining that shell is what makes the home link use the logo's transition.
	// Dev can finish before streaming (404); production PPR can commit first (200).
	expect([200, 404]).toContain(response?.status());
	await expect(page.locator('meta[name="robots"][content="noindex"]').first()).toBeAttached();
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
});

test('the global fallback still returns HTTP 404', async ({ page }) => {
	const response = await page.goto('/404/');
	expect(response?.status()).toBe(404);
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
});

test('pages are served with the security headers', async ({ request }) => {
	const response = await request.get('/');
	const headers = response.headers();

	expect(headers['content-security-policy']).toContain("object-src 'none'");
	expect(headers['content-security-policy']).toContain("frame-ancestors 'self'");
	expect(headers['x-content-type-options']).toBe('nosniff');
	expect(headers['referrer-policy']).toBe('strict-origin-when-cross-origin');
	expect(headers['strict-transport-security']).toContain('max-age=');
});
