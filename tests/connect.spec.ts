// Imports
// ------------
import { expect, type Page, test } from '@playwright/test';

// Helpers
// ------------
// NOTE • An Open Profile click that lands as the intro loader settles can be dropped (no /profile/ push),
// so wait for the loader to finish, as a visitor would, and confirm the panel opened before going on.
const LOADER_TIMEOUT = 15_000;
// NOTE • The site keeps GSAP's lag smoothing: a frame that arrives more than 500ms after the last one moves
// every tween on by 33ms, not by the gap. With software WebGL (CI) the Connect scene draws either side of
// that line (317ms median, 850ms worst measured), and past it a one-second tween needs 30 frames, 15-25s.
// These are waits on the tween's end state: they return as soon as it lands.
const TWEEN_TIMEOUT = 30_000;
const waitForLoader = (page: Page) =>
	expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: LOADER_TIMEOUT });
const openProfile = async (page: Page) => {
	await page.goto('/');
	await waitForLoader(page);
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await expect(page.locator('#profile-panel')).toHaveAttribute('aria-hidden', 'false');
};

// Tests
// ------------
// Protects the Connect footer end to end: social links and resume download work, images load
// and holding the canvas runs the whole matrix charge cycle.
test('connect footer renders its assets, links and complete charge cycle', async ({ page, request }) => {
	await openProfile(page);
	const section = page.locator('[data-connect]');
	await section.scrollIntoViewIfNeeded();
	// Wait for the section to report ready before interacting with it
	await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });

	// Links
	const nav = section.getByRole('navigation');
	for (const [name, href] of [
		['Linkedin', 'https://www.linkedin.com/in/joebentaylor/'],
		['Dribbble', 'https://dribbble.com/joebentaylor'],
		['Github', 'https://github.com/joebentaylor1995'],
		['Email', 'mailto:hey@joebentaylor.co.uk'],
	])
		await expect(nav.getByRole('link', { name, exact: true })).toHaveAttribute('href', href);
	await expect(nav.getByRole('link', { name: 'Resume' })).toHaveAttribute('download', 'Joe Ben Taylor Resume.pdf');
	// The resume must be a real PDF, not a 404 page served as one
	const pdf = await request.get('/downloads/joe-ben-taylor-resume.pdf');
	expect(pdf.ok()).toBe(true);
	expect((await pdf.body()).subarray(0, 5).toString()).toBe('%PDF-');

	// Assets
	for (const image of await section.locator('img').all()) {
		await expect(image).toHaveJSProperty('complete', true);
		expect(await image.evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
	}
	await page.screenshot({ path: 'test-results/connect-desktop.png' });

	// Hold the canvas to charge, then release to disintegrate and return to the idle rain
	const canvas = section.locator('canvas');
	const box = await canvas.boundingBox();
	if (!box) throw new Error('Canvas is missing');
	await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
	await page.mouse.down();
	await expect(section).toHaveAttribute('data-matrix-phase', 'charging');
	await page.waitForTimeout(900);
	await page.mouse.up();
	await expect(section).toHaveAttribute('data-matrix-phase', 'disintegrating');
	await expect(section).toHaveAttribute('data-matrix-phase', 'reforming', { timeout: 12_000 });
	await expect(section).toHaveAttribute('data-matrix-phase', 'rain', { timeout: 12_000 });
});

// Protects the Connect footer on a phone with reduced motion: no horizontal overflow, a tap
// jumps straight to the rain state and the legal links remain.
test('connect fits mobile and remains usable with reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await openProfile(page);
	const section = page.locator('[data-connect]');
	await section.scrollIntoViewIfNeeded();
	await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
	expect(await section.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
	await section.locator('canvas').click({ position: { x: 180, y: 650 } });
	await expect(section).toHaveAttribute('data-matrix-phase', 'rain');
	await page.screenshot({ path: 'test-results/connect-mobile.png' });
	await expect(section.getByRole('link', { name: 'Cookies', exact: true })).toHaveAttribute('href', '/cookies');
	await expect(section.getByRole('link', { name: 'Terms & Privacy', exact: true })).toHaveAttribute(
		'href',
		'/terms-privacy'
	);
	await expect(section.getByRole('link', { name: 'LLMs', exact: true })).toHaveAttribute('href', '/llms');
});

// Protects the narrow-screen layout against the mobile design frame (32px gutters, 376px nav)
// and checks it still fits down to 320px.
test('connect matches the mobile frame and fits narrow screens', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.setViewportSize({ width: 440, height: 1211 });
	await openProfile(page);
	const section = page.locator('[data-connect]');
	await section.scrollIntoViewIfNeeded();
	await expect(section).toHaveAttribute('data-state', 'ready', { timeout: 20_000 });
	await expect(section).toHaveCSS('padding-left', '32px');
	await expect(section.getByRole('navigation')).toHaveCSS('width', '376px');
	await page.screenshot({ path: 'test-results/connect-mobile-figma.png' });

	// Resize through narrow widths: no overflow, CTA centred, time sits under the country
	for (const width of [320, 390, 440]) {
		await page.setViewportSize({ width, height: 844 });
		await section.scrollIntoViewIfNeeded();
		expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
		const cta = await section.locator('[data-connect-title]').boundingBox();
		if (!cta) throw new Error('CTA is missing');
		expect(Math.abs(cta.x + cta.width / 2 - width / 2)).toBeLessThan(1);
		const country = await section.getByText('United Kingdom', { exact: true }).boundingBox();
		const time = await section.locator('time').boundingBox();
		if (!country || !time) throw new Error('Location is missing');
		expect(time.y).toBeGreaterThan(country.y);
		expect(time.x).toBe(country.x);
	}
});

// Protects the Connect interactions: headline reveals, the cursor reacts to each link type,
// the CTA lights its lines and opens the booking dialog without closing Profile.
test('connect reveals its copy, attracts the cursor and opens contact without closing Profile', async ({ page }) => {
	// Each hover waits for the scene's next frames before it lands (2-5s a hover was measured on CI)
	test.slow(!!process.env.CI, 'Software WebGL draws the Connect scene at two or three frames a second');
	await openProfile(page);
	const section = page.locator('[data-connect]');
	await section.scrollIntoViewIfNeeded();
	const cta = section.getByRole('button', { name: /Ready.*Let’s grow/ });
	// Reveal
	await expect(section.getByRole('heading', { name: 'Connect', exact: true })).toHaveAttribute(
		'data-revealed',
		'true'
	);
	await expect
		.poll(
			() =>
				section
					.locator('[data-connect-line]')
					.first()
					.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--tfw-fill'))),
			{ timeout: TWEEN_TIMEOUT }
		)
		.toBeGreaterThan(110);
	await expect(section.locator('[data-year-icon]')).toHaveCSS('opacity', '1', { timeout: TWEEN_TIMEOUT });
	await expect
		.poll(
			() =>
				section
					.locator('[data-year-rule]')
					.first()
					.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a),
			{ timeout: TWEEN_TIMEOUT }
		)
		.toBe(1);

	// Cursor mode on the Profile wrapper changes per link type
	const profile = page.locator('#profile-panel').locator('..');
	const linkedin = section.getByRole('link', { name: 'Linkedin', exact: true });
	await linkedin.hover();
	await expect(profile).toHaveAttribute('data-cursor', 'sticky');
	const legal = section.getByRole('link', { name: 'Terms & Privacy', exact: true });
	await legal.hover();
	await expect(profile).toHaveAttribute('data-cursor', 'soft');
	await expect(legal).toHaveCSS('color', 'rgb(255, 255, 255)');

	// Hovering the CTA shifts and fills the title lines; moving off it drains the hover fill again
	await cta.hover();
	await expect(profile).toHaveAttribute('data-cursor', 'cta');
	await expect
		.poll(
			() =>
				section
					.locator('[data-connect-line]')
					.last()
					.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--tfw-fill'))),
			{ timeout: TWEEN_TIMEOUT }
		)
		.toBeGreaterThan(110);
	await expect
		.poll(
			() =>
				section
					.locator('[data-connect-line]')
					.first()
					.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).f),
			{ timeout: TWEEN_TIMEOUT }
		)
		.toBe(-3);
	await expect
		.poll(
			() =>
				section
					.locator('[data-connect-line]')
					.last()
					.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--hover-fill'))),
			{ timeout: TWEEN_TIMEOUT }
		)
		.toBeGreaterThan(110);
	await legal.hover();
	await expect
		.poll(
			() =>
				section
					.locator('[data-connect-line]')
					.first()
					.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--hover-fill'))),
			{ timeout: TWEEN_TIMEOUT }
		)
		.toBeLessThan(-15);
	await expect
		.poll(
			() =>
				section
					.locator('[data-connect-line]')
					.last()
					.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--tfw-fill'))),
			{ timeout: TWEEN_TIMEOUT }
		)
		.toBeGreaterThan(110);

	// Opening and closing the dialog returns focus to the CTA and leaves Profile open
	await cta.click();
	await expect(page.getByRole('dialog', { name: 'Book a call with Joe Ben Taylor' })).toBeVisible();
	await page.keyboard.press('Escape');
	await expect(page.getByRole('dialog', { name: 'Book a call with Joe Ben Taylor' })).toHaveCount(0);
	await expect(page.locator('#profile-panel')).toHaveAttribute('aria-hidden', 'false');
	await expect(cta).toBeFocused();
	await page.screenshot({ path: 'test-results/connect-interactions.png' });
});
