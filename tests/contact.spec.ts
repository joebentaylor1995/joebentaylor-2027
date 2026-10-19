import { expect, test } from '@playwright/test';

test('booking modal covers the viewport, traps focus and restores it on close', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true');
	const trigger = page.getByRole('button', { name: 'Open Booking Form' });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Book a call with Joe Ben Taylor' });
	await expect(dialog).toBeVisible();
	const bounds = await dialog.boundingBox();
	expect(bounds?.width).toBe(page.viewportSize()?.width);
	expect(bounds?.height).toBe(page.viewportSize()?.height);
	await expect(page.getByRole('button', { name: 'Close booking form' })).toBeFocused();
	await expect(dialog.locator('iframe')).toHaveCount(0);
	await expect(dialog.getByRole('button', { name: 'Allow cookies and load calendar' })).toHaveCSS(
		'color',
		'rgb(0, 0, 0)'
	);
	expect(await dialog.evaluate(element => element.matches(':modal'))).toBe(true);
	await page.keyboard.press('Tab');
	await expect(dialog.getByRole('button', { name: 'Allow cookies and load calendar' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(dialog.getByRole('link', { name: 'Book on Cal.com' })).toBeFocused();
	await expect(dialog).toHaveCSS('opacity', '1');
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveAttribute('data-state', 'closing');
	await expect(dialog).toBeVisible();
	await expect(dialog).toHaveCSS('transition-delay', '0.6s');
	// The calendar finishes its exit before the modal and backdrop start fading.
	await expect
		.poll(
			() =>
				dialog.evaluate(element => {
					const content = element.querySelector('[inert]');
					return (
						content !== null &&
						Number(getComputedStyle(content).opacity) < 0.5 &&
						getComputedStyle(element, '::backdrop').opacity === '1'
					);
				}),
			{ intervals: [20] }
		)
		.toBe(true);
	await expect(dialog).toBeVisible();
	await expect(dialog).toHaveCount(0);
	await expect(trigger).toBeFocused();
	await trigger.click();
	await page.getByRole('button', { name: 'Close booking form' }).click();
	await expect(trigger).toBeFocused();
});

test('reduced motion closes the modal without a fade', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true');
	const trigger = page.getByRole('button', { name: 'Open Booking Form' });
	await trigger.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toHaveCSS('transition-duration', '0s');
	await page.getByRole('button', { name: 'Close booking form' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(trigger).toBeFocused();
});

test('Cal.com loads only after consent and preserves the booking URL', async ({ page }) => {
	const requests: string[] = [];
	await page.route('https://app.cal.com/**', route => {
		requests.push(route.request().url());
		return route.abort();
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Booking Form' }).click();
	expect(requests).toHaveLength(0);
	await expect(page.getByRole('link', { name: 'Book on Cal.com' })).toHaveAttribute(
		'href',
		'https://cal.com/joebentaylor/30min?overlayCalendar=true'
	);
	await page.getByRole('button', { name: 'Allow cookies and load calendar' }).click();
	await expect.poll(() => requests.length).toBeGreaterThan(0);
	await expect(page.getByRole('link', { name: 'Calendar not loading?' })).toBeVisible();
	await expect(page.getByRole('status')).toHaveText('Loading calendar…');
	await expect(page.getByRole('dialog').locator('[aria-busy]')).toHaveAttribute('aria-busy', 'true');
	await expect(page.getByRole('dialog').locator('[inert]')).toHaveCSS('opacity', '0');
	const embed = page.getByRole('dialog').locator('[inert]');
	await expect(embed).toHaveCSS('visibility', 'hidden');
	// Simulate Cal inserting (and later replacing) its iframe while the remote page loads.
	for (let insertion = 0; insertion < 2; insertion++) {
		await embed.evaluate(element => {
			element.querySelector('iframe')?.remove();
			element.appendChild(document.createElement('iframe'));
		});
		await expect(embed.locator('iframe')).toHaveAttribute('scrolling', 'no');
		await expect(embed.locator('iframe')).toHaveAttribute('title', 'Book a 30-minute call with Joe Ben Taylor');
	}
	await expect(page.getByRole('dialog')).toHaveCSS('overflow-y', 'hidden');
	await expect(page.getByRole('dialog')).toHaveCSS('scrollbar-width', 'none');
	await expect(page.locator('html')).toHaveAttribute('data-cookie-consent', 'marketing');
});

test('booking modal fits a narrow viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/', { waitUntil: 'domcontentloaded' });
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true');
	// The development-only Next badge overlaps the right side at this width.
	await page.getByRole('button', { name: 'Open Booking Form' }).click({ position: { x: 3, y: 8 } });
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
	await expect(page.getByRole('button', { name: 'Close booking form' })).toBeInViewport();
});
