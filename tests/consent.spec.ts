// Cookie Consent
// ------------
// Covers the choice, its persistence before first paint, and
// withdrawing consent from the settings.

// Imports
// ------------
import { expect, test } from '@playwright/test';

// Helpers
// ------------
// Runs in the page: the consent choice is mirrored onto <html> as a data attribute.
const consentAttribute = () => document.documentElement.getAttribute('data-cookie-consent');

// Tests
// ------------
test('stores a per-category choice and hides the banner for returning visitors', async ({ page }) => {
	await page.goto('/');
	const banner = page.getByRole('region', { name: 'Cookies' });
	await expect(banner).toBeVisible();

	// Opt in to analytics only
	await banner.getByRole('button', { name: 'Let me choose' }).click();
	await expect(banner.getByRole('checkbox', { name: /Analytics/ })).not.toBeChecked();
	await banner.getByRole('checkbox', { name: /Analytics/ }).check();
	await banner.getByRole('button', { name: 'Save Choices' }).click();

	await expect(banner).toBeHidden();
	expect(await page.evaluate(consentAttribute)).toBe('analytics');

	// A returning visitor sees no banner and keeps the choice
	await page.reload();
	await expect(banner).toBeHidden();
	expect(await page.evaluate(consentAttribute)).toBe('analytics');
});

// Declining everything optional must record only the necessary category.
test('Accept Necessary grants nothing optional', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	expect(await page.evaluate(consentAttribute)).toBe('necessary');
});

// Accept All covers the calendar embed too, so Cal.com loads without asking again after a reload.
test('Accept All includes the calendar and stays accepted after reload', async ({ page }) => {
	const calendarRequests: string[] = [];
	// Cal.com is aborted: only the fact that a request was attempted matters
	await page.route('https://app.cal.com/**', route => {
		calendarRequests.push(route.request().url());
		return route.abort();
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Accept All', exact: true }).click();
	expect(await page.evaluate(consentAttribute)).toBe('analytics marketing');
	await page.getByRole('button', { name: 'Open Booking Form' }).click();
	await expect(page.getByRole('button', { name: 'Allow cookies and load calendar' })).toHaveCount(0);
	await expect.poll(() => calendarRequests.length).toBeGreaterThan(0);

	// Consent persists, so the calendar loads on the next visit without the prompt
	await page.reload();
	await expect(page.getByRole('region', { name: 'Cookies', exact: true })).toBeHidden();
	await page.getByRole('button', { name: 'Open Booking Form' }).click();
	await expect(page.getByRole('button', { name: 'Allow cookies and load calendar' })).toHaveCount(0);
	await expect(page.getByRole('status')).toHaveText('Loading calendar…');
});

// Withdrawing consent must remove tracking cookies and reload so nothing keeps running.
test('withdrawing consent from the settings clears cookies and reloads', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Accept All' }).click();
	// Plant a fake GA cookie and reopen the cookie settings through the same event the site uses
	await page.evaluate(() => {
		// biome-ignore lint/suspicious/noDocumentCookie: simulating a tracking cookie
		document.cookie = '_ga=test;path=/';
		window.dispatchEvent(new Event('tackl:cookie-settings'));
	});

	// Untick everything optional and save; saving triggers a full page load
	const banner = page.getByRole('region', { name: 'Cookies' });
	await expect(banner).toBeVisible();
	await banner.getByRole('checkbox', { name: /Analytics/ }).uncheck();
	await banner.getByRole('checkbox', { name: /Calendar/ }).uncheck();
	await Promise.all([page.waitForEvent('load'), banner.getByRole('button', { name: 'Save Choices' }).click()]);

	// Back to necessary only, with the planted cookie cleared
	expect(await page.evaluate(consentAttribute)).toBe('necessary');
	expect(await page.evaluate(() => document.cookie)).not.toContain('_ga');
});
