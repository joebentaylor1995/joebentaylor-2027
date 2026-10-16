import { expect, test } from '@playwright/test';

for (const width of [1440, 440]) {
	test(`profile reveals and scrolls independently at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/');
		const trigger = page.getByRole('button', { name: 'Open Profile', exact: true });
		await expect(page.locator('header')).toHaveAttribute('data-header-entrance', 'complete', { timeout: 15000 });
		await trigger.click();
		const panel = page.getByRole('dialog', { name: 'Profile', exact: true });
		await expect(panel).toHaveCSS('transform', 'none');
		await expect(panel).toHaveCSS('clip-path', 'inset(0px)');
		const close = page.getByRole('button', { name: 'Close profile' });
		await expect(close).toBeFocused();
		await expect(panel).toHaveClass(/\blenis\b/);
		const scene = page.locator('#profile-panel + div');
		await expect
			.poll(() =>
				scene.evaluate(element => {
					const matrix = new DOMMatrix(getComputedStyle(element).transform);
					return Math.round(matrix.e);
				})
			)
			.toBe(Math.round(-width * 0.12));
		await expect(scene).toHaveAttribute('inert');
		const bounds = await panel.boundingBox();
		expect(bounds?.width).toBeCloseTo(Math.min(971, width), 0);
		expect(bounds?.x).toBeCloseTo(Math.max(0, width - 971), 0);
		if (width > 971) {
			for (const [x, y] of [
				[100, 300],
				[300, 500],
				[150, 350],
			]) {
				await page.mouse.move(x, y);
				// Chromium can coalesce pointer events until the next frame.
				await page.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => resolve())));
				const icon = await page.locator('[data-close-cursor] svg').boundingBox();
				if (!icon) throw new Error('Close cursor missing');
				expect(icon.x + icon.width / 2).toBeCloseTo(x, 1);
				expect(icon.y + icon.height / 2).toBeCloseTo(y, 1);
			}
		}
		await expect(scene).toHaveCSS('clip-path', 'none');
		await expect(scene).toHaveAttribute('data-scene-paused', 'true');
		await expect(page.locator('[data-profile-scene] + button')).toHaveCSS('opacity', '1');
		await expect(page.locator('[data-profile-scene] + button')).toHaveCSS(
			'background-color',
			'color(srgb 0 0 0 / 0.6)'
		);
		await panel.hover();
		const pageScroll = await page.locator('#page').evaluate(element => element.scrollTop);
		await page.mouse.wheel(0, 500);
		await expect(panel).toHaveClass(/\blenis-smooth\b/);
		await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBeGreaterThan(100);
		expect(await page.locator('#page').evaluate(element => element.scrollTop)).toBe(pageScroll);
		await expect(close).toBeInViewport();
		const toolkitBounds = await panel.locator('[data-toolkit="Design toolkit"]').boundingBox();
		await panel.hover();
		await page.mouse.wheel(0, (toolkitBounds?.y ?? 200) - 200);
		await expect(panel.locator('[data-toolkit="Design toolkit"]')).toHaveAttribute('data-state', 'ready');
		await close.press('Tab');
		await expect(panel.locator('[data-tool="figma"]')).toBeFocused();
		await panel.locator('[data-tool="figma"]').press('Shift+Tab');
		await expect(close).toBeFocused();
		await close.press('Escape');
		await expect(panel).toBeHidden();
		await expect(trigger).toBeFocused();
		await expect(scene).not.toHaveAttribute('inert');
		await expect(scene).not.toHaveAttribute('data-scene-paused');
		await trigger.click();
		await expect(panel).toBeVisible();
		await expect.poll(() => panel.evaluate(element => element.scrollTop)).toBe(0);
		await close.click();
		await expect(panel).toBeHidden();
	});
}

test('profile cursor follows, sticks to close, and dismisses from the backdrop', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	const trigger = page.getByRole('button', { name: 'Open Profile', exact: true });
	await trigger.click();
	const panel = page.getByRole('dialog', { name: 'Profile', exact: true });
	const shell = page.locator('#profile-panel').locator('..');
	const close = page.getByRole('button', { name: 'Close profile', exact: true });
	await page.mouse.move(1000, 450);
	await expect(shell).toHaveAttribute('data-cursor', 'follow');
	await expect(panel).toHaveCSS('cursor', 'auto');
	const closeBounds = await close.boundingBox();
	if (!closeBounds) throw new Error('Close control missing');
	await page.mouse.move(closeBounds.x + closeBounds.width + 16, closeBounds.y + closeBounds.height / 2);
	await expect(shell).toHaveAttribute('data-cursor', 'sticky');
	await close.hover();
	await expect(shell).toHaveAttribute('data-cursor', 'sticky');
	await expect(close).toHaveCSS('cursor', 'pointer');
	await expect(close).toHaveCSS('border-top-width', '0px');
	await page.mouse.move(200, 450);
	await expect(shell).toHaveAttribute('data-cursor', 'close');
	await expect(page.locator('[data-profile-scene] + button')).toHaveCSS('cursor', 'none');
	await page.mouse.click(200, 450);
	await expect(panel).toBeHidden();
	await expect(shell).not.toHaveAttribute('data-cursor');
	await expect(trigger).toBeFocused();
});

test('profile supports reduced motion and viewport changes while open', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	const trigger = page.getByRole('button', { name: 'Open Profile', exact: true });
	await trigger.click();
	const panel = page.getByRole('dialog', { name: 'Profile', exact: true });
	await expect(panel).toBeVisible();
	await expect(panel).not.toHaveClass(/\blenis\b/);
	await page.setViewportSize({ width: 440, height: 900 });
	await expect.poll(() => panel.evaluate(element => Math.round(element.getBoundingClientRect().width))).toBe(440);
	await page.getByRole('button', { name: 'Close profile' }).click();
	await expect(panel).toBeHidden();
	await expect(trigger).toBeFocused();
});
