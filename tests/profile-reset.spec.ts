import { expect, test } from '@playwright/test';

test('closing from the footer keeps content behind the retreating clip edge', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const panel = page.locator('#profile-panel');
	await expect(panel).toHaveCSS('clip-path', 'inset(0px)');
	await page.locator('[data-connect-copyright]').scrollIntoViewIfNeeded();
	await expect
		.poll(() => panel.locator(':scope > div').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).e))
		.toBe(0);
	await page.keyboard.press('Escape');
	const samples = await panel.evaluate(element => {
		const content = element.firstElementChild as HTMLElement;
		const animations = [...element.getAnimations(), ...content.getAnimations()];
		for (const animation of animations) animation.pause();
		return [50, 100, 250, 500, 800].map(time => {
			for (const animation of animations) animation.currentTime = time;
			const clip = getComputedStyle(element).clipPath.slice(6, -1).split(/\s+/);
			const left = clip.length === 4 ? parseFloat(clip[3]) : parseFloat(clip[1] ?? clip[0]);
			return {
				covered: (element.clientWidth * left) / 100,
				drift: new DOMMatrix(getComputedStyle(content).transform).e,
			};
		});
	});
	for (const sample of samples) expect(sample.drift).toBeLessThanOrEqual(sample.covered + 0.5);
	await panel.evaluate(element => {
		for (const target of [element, element.firstElementChild])
			for (const animation of target?.getAnimations() ?? []) animation.play();
	});
	await expect(panel).toBeHidden();
});

test('profile media resets only after the closing animation settles', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const panel = page.getByRole('dialog', { name: 'Profile', exact: true });
	const shell = page.locator('#profile-panel').locator('..');
	const toolkit = page.locator('[data-toolkit="Design toolkit" i]');
	await toolkit.scrollIntoViewIfNeeded();
	await expect(toolkit).toHaveAttribute('data-state', 'ready');
	const video = page.locator('[data-featured-video]').first();
	await video.scrollIntoViewIfNeeded();
	await expect(video).toHaveJSProperty('paused', false);
	const source = await video.getAttribute('src');
	if (!source) throw new Error('Visible Profile video has no source');
	await page.emulateMedia({ reducedMotion: 'no-preference' });
	await page.getByRole('button', { name: 'Close profile', exact: true }).press('Escape');
	await expect(shell).toHaveAttribute('data-state', 'closing');
	await expect(toolkit.locator('canvas')).toHaveCount(1);
	await expect(video).toHaveAttribute('src', source);
	await expect(shell).toHaveAttribute('data-state', 'closed');
	await expect(toolkit.locator('canvas')).toHaveCount(0);
	await expect(video).not.toHaveAttribute('src');
	await expect(video).toHaveJSProperty('currentTime', 0);
	await expect(panel).toBeHidden();
});
