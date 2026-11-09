// Imports
// ------------
import { expect, test } from '@playwright/test';

// Config
// ------------
// The site loader plays for several seconds by design and runs longer on a busy or GPU-less runner
const LOADER_TIMEOUT = 20_000;
// The calendar is a lazily loaded chunk that injects Cal.com's script when it mounts; on a contended
// runner the chunk alone can take several seconds to arrive
const CALENDAR_MOUNT_TIMEOUT = 15_000;

// Tests
// ------------
// Protects the booking modal as a proper modal dialog: full-viewport, focus moves in and stays
// trapped, the calendar fades before the shell, and focus returns to the trigger on close.
test('booking modal covers the viewport, traps focus and restores it on close', async ({ page }) => {
	await page.goto('/');
	// Wait for the site loader to complete before opening the modal
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', {
		timeout: LOADER_TIMEOUT,
	});
	const trigger = page.getByRole('button', { name: 'Open Booking Form' });
	await trigger.click();
	const dialog = page.getByRole('dialog', { name: 'Book a call with Joe Ben Taylor' });
	await expect(dialog).toBeVisible();

	// Opens full-bleed with focus on the close button
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

	// Tab order stays inside the dialog
	await page.keyboard.press('Tab');
	await expect(dialog.getByRole('button', { name: 'Allow cookies and load calendar' })).toBeFocused();
	await page.keyboard.press('Tab');
	await expect(dialog.getByRole('link', { name: 'Book on Cal.com' })).toBeFocused();
	await expect(dialog).toHaveCSS('opacity', '1');

	// Closing is staged: the shell waits (transition-delay) while the calendar fades first.
	// The closing transitions are paused as they start, so the staging is checked at a fixed point in
	// the timeline rather than by sampling a few hundred milliseconds of a busy page.
	await dialog.evaluate(element => {
		element.addEventListener(
			'transitionrun',
			() => {
				for (const animation of element.getAnimations({ subtree: true })) animation.pause();
				element.dataset.closingPaused = 'true';
			},
			{ once: true }
		);
	});
	await page.keyboard.press('Escape');
	await expect(dialog).toHaveAttribute('data-closing-paused', 'true');
	await expect(dialog).toHaveAttribute('data-state', 'closing');
	await expect(dialog).toBeVisible();
	await expect(dialog).toHaveCSS('transition-delay', '0.6s');
	// The calendar finishes its exit before the modal and backdrop start fading.
	const opacitiesWhenCalendarHasFaded = await dialog.evaluate(element => {
		const content = element.querySelector('[inert]');
		if (!content) throw new Error('Closing content is not inert');
		const animations = element.getAnimations({ subtree: true });
		const calendarFade = animations.find(
			animation =>
				animation instanceof CSSTransition &&
				animation.transitionProperty === 'opacity' &&
				animation.effect instanceof KeyframeEffect &&
				animation.effect.target === content
		);
		const calendarFadeEnd = calendarFade?.effect?.getComputedTiming().endTime;
		if (typeof calendarFadeEnd !== 'number') throw new Error('Calendar fade-out transition not found');
		for (const animation of animations) animation.currentTime = calendarFadeEnd;
		const opacities = {
			calendar: getComputedStyle(content).opacity,
			modal: getComputedStyle(element).opacity,
			backdrop: getComputedStyle(element, '::backdrop').opacity,
		};
		for (const animation of animations) animation.play();
		return opacities;
	});
	expect(opacitiesWhenCalendarHasFaded).toEqual({ calendar: '0', modal: '1', backdrop: '1' });
	await expect(dialog).toBeVisible();
	await expect(dialog).toHaveCount(0);
	await expect(trigger).toBeFocused();
	await trigger.click();
	await page.getByRole('button', { name: 'Close booking form' }).click();
	await expect(trigger).toBeFocused();
});

// Users who prefer reduced motion get an instant close with no transition.
test('reduced motion closes the modal without a fade', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', {
		timeout: LOADER_TIMEOUT,
	});
	const trigger = page.getByRole('button', { name: 'Open Booking Form' });
	await trigger.click();
	const dialog = page.getByRole('dialog');
	await expect(dialog).toHaveCSS('transition-duration', '0s');
	await page.getByRole('button', { name: 'Close booking form' }).click();
	await expect(dialog).toHaveCount(0);
	await expect(trigger).toBeFocused();
});

// Protects consent for the calendar: nothing requests Cal.com until the visitor allows it,
// and the embed stays hidden and busy while the remote page loads.
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
	// The calendar mounts busy, and requests Cal.com as it mounts
	await expect(page.getByRole('dialog').locator('[aria-busy]')).toHaveAttribute('aria-busy', 'true', {
		timeout: CALENDAR_MOUNT_TIMEOUT,
	});
	await expect.poll(() => requests.length).toBeGreaterThan(0);
	await expect(page.getByRole('link', { name: 'Calendar not loading?' })).toBeVisible();
	await expect(page.getByRole('dialog').getByRole('status')).toHaveText('Loading calendar…');
	await expect(page.getByRole('dialog').locator('[inert]')).toHaveCSS('opacity', '0');

	// The embed stays hidden until it has loaded
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

// Protects the phone layout: the dialog does not overflow and the close button stays reachable.
test('booking modal fits a narrow viewport', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.goto('/', { waitUntil: 'domcontentloaded' });
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', {
		timeout: LOADER_TIMEOUT,
	});
	// The development-only Next badge overlaps the right side at this width.
	await page.getByRole('button', { name: 'Open Booking Form' }).click({ position: { x: 3, y: 8 } });
	const dialog = page.getByRole('dialog');
	await expect(dialog).toBeVisible();
	expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
	await expect(page.getByRole('button', { name: 'Close booking form' })).toBeInViewport();
});
