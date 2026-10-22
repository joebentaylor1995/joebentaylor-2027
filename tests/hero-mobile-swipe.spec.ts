import { expect, test } from './helpers/test';

test.use({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });

test('mobile portrait loads a detailed image and responds to native swipes', async ({ page }) => {
	await page.addInitScript(() => {
		const names = new WeakMap<WebGLUniformLocation, string>();
		const getLocation = WebGLRenderingContext.prototype.getUniformLocation;
		const uniform = WebGLRenderingContext.prototype.uniform1f;
		Object.assign(window, { portraitSwipePeak: 0 });
		WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
			const location = getLocation.call(this, program, name);
			if (location) names.set(location, name);
			return location;
		};
		WebGLRenderingContext.prototype.uniform1f = function (location, value) {
			if (location && names.get(location) === 'scrollVelocity') {
				const state = window as unknown as { portraitSwipePeak: number };
				state.portraitSwipePeak = Math.max(state.portraitSwipePeak, Math.abs(value));
			}
			uniform.call(this, location, value);
		};
	});
	await page.goto('/');
	const portrait = page.getByTestId('hero-depth');
	await expect(portrait).toHaveAttribute('data-ready', 'true', { timeout: 30000 });
	await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
	const source = await portrait.locator('img').evaluate(image => (image as HTMLImageElement).currentSrc);
	expect(Number(new URL(source).searchParams.get('w'))).toBeGreaterThanOrEqual(1920);
	// Phones get the lighter encode (see PORTRAIT_QUALITY in Hero/Background) — still full cover width
	expect(new URL(source).searchParams.get('q')).toBe('75');
	const client = await page.context().newCDPSession(page);
	await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 195, y: 650 }] });
	for (const y of [625, 590, 550, 500, 440]) {
		await client.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 195, y }] });
		await page.waitForTimeout(40);
	}
	await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
	await expect
		.poll(() => page.evaluate(() => (window as unknown as { portraitSwipePeak: number }).portraitSwipePeak))
		.toBeGreaterThan(0.05);
	await page.screenshot({ path: 'test-results/hero-mobile-swipe.png' });
});
