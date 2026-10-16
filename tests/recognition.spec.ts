import { expect, type Locator, test } from '@playwright/test';

test('Recognition settings update live, persist, reset, and scrolling controls direction', async ({ page }) => {
	await page.goto('/?modalSettings');
	const settings = page.getByRole('complementary', { name: 'Modal settings' });
	await settings.getByRole('button', { name: 'Show Recognition', exact: true }).click();
	const section = page.locator('[data-recognition]');
	await expect(section).toHaveAttribute('data-state', 'ready');
	await settings.locator('#modal-awardSize').fill('120');
	await settings.locator('#modal-awardSpeed').fill('2');
	await settings.locator('#modal-awardDragEasing').fill('0.4');
	await settings.locator('#modal-awardBendStrength').fill('1.5');
	await settings.locator('#modal-awardHoverIntensity').fill('0.5');
	await settings.locator('#modal-awardFocusDuration').fill('1.2');
	await expect(section).toHaveAttribute('data-bend-strength', '1.5');
	await expect(section).toHaveAttribute('data-hover-intensity', '0.5');
	await expect(section).toHaveAttribute('data-focus-duration', '1.2');
	await expect(settings.locator('#modal-awardMotionBlur')).toHaveCount(0);
	await expect(settings.locator('#modal-awardDepthOfField')).toHaveCount(0);
	await expect(settings.locator('#modal-awardThickness')).toHaveCount(0);
	await expect(section).toHaveAttribute('data-award-size', '120');
	await expect(section).toHaveAttribute('data-drag-easing', '0.4');
	const speed = async () => Number(await section.getAttribute('data-spiral-speed'));
	await expect.poll(speed).toBeCloseTo(0.046, 3);
	await page.locator('#profile-panel').evaluate(el => {
		el.scrollTop += 100;
	});
	await expect.poll(speed, { intervals: [16, 32, 50] }).toBeGreaterThan(0.05);
	await page.locator('#profile-panel').evaluate(el => {
		el.scrollTop -= 200;
	});
	await expect.poll(speed).toBeLessThan(0);
	await expect.poll(speed).toBeCloseTo(-0.046, 3);
	await page.reload();
	await expect(settings.locator('#modal-awardSize')).toHaveValue('120');
	await expect(settings.locator('#modal-awardSpeed')).toHaveValue('2');
	await expect(settings.locator('#modal-awardDragEasing')).toHaveValue('0.4');
	await expect(settings.locator('#modal-awardBendStrength')).toHaveValue('1.5');
	await expect(settings.locator('#modal-awardHoverIntensity')).toHaveValue('0.5');
	await expect(settings.locator('#modal-awardFocusDuration')).toHaveValue('1.2');
	await settings.getByRole('button', { name: 'Reset defaults' }).click();
	await expect(settings.locator('#modal-awardSize')).toHaveValue('85');
	await expect(settings.locator('#modal-awardSpeed')).toHaveValue('2.4');
	await expect(settings.locator('#modal-awardDragEasing')).toHaveValue('0.18');
	await expect(settings.locator('#modal-awardScrollBoost')).toHaveValue('2');
	await expect(settings.locator('#modal-awardBendStrength')).toHaveValue('2.7');
	await expect(settings.locator('#modal-awardHoverIntensity')).toHaveValue('0.1');
	await expect(settings.locator('#modal-awardFocusDuration')).toHaveValue('0.6');
});

async function scrollRecognition(section: Locator, progress: number) {
	await section.evaluate((element, value) => {
		const root = element.closest('#profile-panel') as HTMLElement;
		root.scrollTop +=
			element.getBoundingClientRect().top -
			root.getBoundingClientRect().top +
			Math.max((element as HTMLElement).offsetHeight - root.clientHeight, 0) * value;
	}, progress);
}

test('Recognition keeps its copy outside the scene and scrolls as a normal section', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const section = page.locator('[data-recognition]');
	await scrollRecognition(section, 0.1);
	await expect(section).toHaveAttribute('data-state', 'ready');
	await expect(section).toHaveAttribute('data-awards', '52');
	const stage = section.locator('[data-recognition-stage]');
	await expect(stage).toHaveCSS('position', 'relative');
	for (const copy of await section.locator('[data-recognition-copy]').all()) {
		await expect(copy).toHaveCSS('opacity', '1');
	}
	const before = await stage.boundingBox();
	await scrollRecognition(section, 0.9);
	const after = await stage.boundingBox();
	expect((before?.y ?? 0) - (after?.y ?? 0)).toBeGreaterThan(100);
	expect(
		await section.evaluate(el => el.clientHeight - (el.firstElementChild as HTMLElement).clientHeight)
	).toBeLessThan(3);
});

test('Recognition isolates an award, returns without closing Profile, and reopens cleanly', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const section = page.locator('[data-recognition]');
	await scrollRecognition(section, 0.25);
	await expect(section).toHaveAttribute('data-state', 'ready');
	const canvas = section.locator('canvas');
	await canvas.press('Enter');
	await expect(section).toHaveAttribute('data-focus', 'true');
	await expect
		.poll(async () => Number(await section.getAttribute('data-paper-curl')), { intervals: [30, 50] })
		.toBeGreaterThan(0.2);
	await expect(section).toHaveAttribute('data-paper-curl', '0.000');
	const canvasBounds = await canvas.boundingBox();
	if (!canvasBounds) throw new Error('Award canvas is missing');
	await page.mouse.move(canvasBounds.x + canvasBounds.width * 0.6, canvasBounds.y + canvasBounds.height * 0.45);
	await expect.poll(async () => Number(await section.getAttribute('data-paper-flex'))).toBeGreaterThan(0.1);
	await page.mouse.move(0, 0);
	await expect.poll(async () => Number(await section.getAttribute('data-paper-flex'))).toBeLessThan(0.01);
	await expect(page.getByRole('button', { name: 'Return to spiral' })).toBeVisible();
	await canvas.press('Escape');
	await expect
		.poll(async () => Number(await section.getAttribute('data-paper-curl')), { intervals: [30, 50] })
		.toBeGreaterThan(0.2);
	await expect(section).toHaveAttribute('data-focus', 'false');
	await expect(page.locator('#profile-panel')).toHaveAttribute('aria-hidden', 'false');
	await expect(section.locator('[data-recognition-pause]')).toHaveCount(0);
	await page.getByRole('button', { name: 'Close profile', exact: true }).click();
	await expect(section).toHaveAttribute('data-state', 'loading');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await scrollRecognition(section, 0.25);
	await expect(section).toHaveAttribute('data-state', 'ready');
	await expect(section).toHaveAttribute('data-awards', '52');
});

test('Recognition fits mobile and respects reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const section = page.locator('[data-recognition]');
	await scrollRecognition(section, 0);
	await expect(section).toHaveAttribute('data-state', 'ready');
	await expect(section).toHaveAttribute('data-spiral-speed', '0.0000');
	for (const width of [320, 390, 440]) {
		await page.setViewportSize({ width, height: 1000 });
		await expect(section.locator('h2')).toHaveCSS('font-size', '32px');
		await expect(section.locator('p').first()).toHaveCSS('font-size', '18px');
		await expect(section.locator('[data-recognition-copy="intro"]')).toHaveCSS('gap', '16px');
		for (const element of [
			section,
			section.locator('[data-recognition-stage]'),
			section.locator('canvas'),
			page.locator('#profile-panel'),
		]) {
			const size = await element.evaluate(el => ({ client: el.clientWidth, scroll: el.scrollWidth }));
			expect(size.client).toBeLessThanOrEqual(width);
			expect(size.scroll).toBeLessThanOrEqual(size.client);
		}
		const stage = await section.locator('[data-recognition-stage]').boundingBox();
		const intro = await section.locator('[data-recognition-copy="intro"]').boundingBox();
		expect(stage?.height).toBe(934);
		expect((intro?.x ?? 0) - (stage?.x ?? 0)).toBe(32);
		expect((intro?.y ?? 0) - (stage?.y ?? 0)).toBe(64);
	}
	await scrollRecognition(section, 0);
	await section.screenshot({ path: 'test-results/recognition-mobile.png' });
	await expect(section.locator('canvas')).toHaveCSS('touch-action', 'pan-y');
});
