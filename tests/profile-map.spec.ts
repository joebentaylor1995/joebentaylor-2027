// Imports
// ------------
import { expect, test } from '@playwright/test';
import { simplifyRing } from '../src/components/Profile/Usps/Map/geometry';
import { framing, projectLocation, rotation, SETTLED } from '../src/components/Profile/Usps/Map/projection';
import { defaults } from '../src/components/ProfileReveal/Settings/store';

// Tests
// ------------
// Protects the approved globe framing with plain maths (no browser): the settled position projects to a
// fixed point at the reference size, and stays inside the same part of the frame at other sizes.
test('the globe preserves the manually selected position', () => {
	const capturedFrame = framing(433.5, 325);
	const capturedPoint = projectLocation(rotation(SETTLED));
	expect(capturedFrame.x + capturedPoint.x * capturedFrame.radius).toBeCloseTo(256.54823846, 5);
	expect(capturedFrame.y - capturedPoint.y * capturedFrame.radius).toBeCloseTo(197.61357671, 5);
	// Marker must land in the 50% to 70% band of each axis and face the camera (z > 0)
	for (const [width, height] of [
		[440, 325],
		[320, 325],
		[900, 600],
	]) {
		const frame = framing(width, height);
		const point = projectLocation(rotation(SETTLED));
		expect(frame.x + point.x * frame.radius).toBeGreaterThan(width * 0.5);
		expect(frame.x + point.x * frame.radius).toBeLessThan(width * 0.7);
		expect(frame.y - point.y * frame.radius).toBeGreaterThan(height * 0.5);
		expect(frame.y - point.y * frame.radius).toBeLessThan(height * 0.7);
		expect(point.z).toBeGreaterThan(0);
	}
});

// Protects the Profile globe: the marker sits where the saved settings place it, keyboard keys explore and
// reset the view, and closing and reopening starts again from the settled position.
for (const width of [1440, 440]) {
	test(`profile globe preserves Doncaster's position, supports keyboard exploration and resets on reopen at ${width}px`, async ({
		page,
	}) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.goto('/');
		const map = page.locator('[data-globe]');
		const canvas = map.locator('canvas');
		const marker = map.locator('[data-globe-marker]');
		await expect(map).toHaveAttribute('data-state', 'loading');
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await map.scrollIntoViewIfNeeded();
		await expect(map).toHaveAttribute('data-state', 'ready');
		// Recomputes where the marker should be from the saved defaults and the globe framing, and compares it
		// with the real marker position
		const centred = async () => {
			const area = await map.boundingBox();
			const pin = await marker.boundingBox();
			if (!area || !pin) throw new Error('Map bounds unavailable');
			const frame = framing(area.width, area.height);
			const point = projectLocation(
				rotation({ latitude: defaults.globeLatitude, longitude: defaults.globeLongitude })
			);
			const x =
				area.width / 2 +
				(frame.x - area.width / 2 + point.x * frame.radius) * defaults.globeZoom +
				(area.width * defaults.globeX) / 100;
			const y =
				area.height / 2 +
				(frame.y - area.height / 2 - point.y * frame.radius) * defaults.globeZoom +
				(area.height * defaults.globeY) / 100;
			expect(pin.x + pin.width / 2).toBeCloseTo(area.x + x, 1);
			expect(pin.y + pin.height / 2).toBeCloseTo(area.y + y, 1);
		};
		await centred();
		await expect(marker).toHaveCSS('opacity', '1');
		await expect(map.locator('div').first()).toHaveCSS('background-image', /linear-gradient/);

		// Arrow keys explore; Home returns to the settled view
		await canvas.press('ArrowLeft');
		await expect(map).toHaveAttribute('data-state', 'exploring');
		await canvas.press('Home');
		await expect(map).toHaveAttribute('data-state', 'ready');
		await centred();
		await page.screenshot({ path: `test-results/profile-map-${width}.png` });

		// Escape resets, and reopening shows the settled globe again
		await canvas.press('Escape');
		await expect(map).toHaveAttribute('data-state', 'loading');
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await map.scrollIntoViewIfNeeded();
		await expect(map).toHaveAttribute('data-state', 'ready');
		await centred();
		await expect(map.locator('canvas')).toHaveCount(1);
	});
}

// Protects the globe entrance and pointer easing: the canvas fades in rather than popping, and moving the
// pointer to the edge shifts the marker, then easing back when the pointer leaves.
test('globe journey settles and pointer movement eases back to Doncaster', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const map = page.locator('[data-globe]');
	// Records the canvas opacity on every attribute change until ready, to prove an in-between value occurred
	const revealSamples = map.evaluate(
		element =>
			new Promise<number[]>(resolve => {
				const samples: number[] = [];
				const observer = new MutationObserver(() => {
					const canvas = element.querySelector('canvas');
					if (!canvas) return;
					const opacity = Number(getComputedStyle(canvas).opacity);
					samples.push(opacity);
					if (element.getAttribute('data-state') === 'ready' && opacity === 1) {
						observer.disconnect();
						resolve(samples);
					}
				});
				observer.observe(element, { attributes: true });
			})
	);
	await map.scrollIntoViewIfNeeded();
	await page.mouse.move(0, 0);
	await expect(map).toHaveAttribute('data-state', 'ready', { timeout: 8000 });
	expect((await revealSamples).some(opacity => opacity > 0 && opacity < 1)).toBe(true);
	await expect(map.locator('canvas')).toHaveCSS('opacity', '1');

	// Pointer near the right edge pushes the marker more than 5px; leaving brings it back within 0.1px
	const marker = map.locator('[data-globe-marker]');
	const resting = await marker.boundingBox();
	const bounds = await map.boundingBox();
	if (!resting || !bounds) throw new Error('Globe bounds unavailable');
	await page.mouse.move(bounds.x + bounds.width - 15, bounds.y + bounds.height / 2);
	await expect
		.poll(async () => Math.abs(((await marker.boundingBox())?.x ?? resting.x) - resting.x))
		.toBeGreaterThan(5);
	await page.mouse.move(0, 0);
	await expect.poll(async () => Math.abs(((await marker.boundingBox())?.x ?? 0) - resting.x)).toBeLessThan(0.1);
});

// Pure geometry check: tiny wiggles are dropped, the sharp bend and the endpoints are kept.
test('coastline simplification removes subpixel detail while preserving significant bends', () => {
	const ring: [number, number][] = [
		[0, 0],
		[0.1, 0.001],
		[0.2, 0],
		[0.3, 0.5],
		[0.4, 0],
		[0, 0],
	];
	const result = simplifyRing(ring);
	expect(result.length).toBeLessThan(ring.length);
	expect(result).toContainEqual([0.3, 0.5]);
	expect(result[0]).toEqual(ring[0]);
	expect(result.at(-1)).toEqual(ring.at(-1));
});

// Protects scrolling while the globe prepares: the geometry is processed in a worker (not on the main
// thread), the modal layout does not shift, and scroll position changes smoothly each frame.
test('globe preparation stays off the scroll thread and preserves modal layout', async ({ page }) => {
	let geometryWorkerStarted = false;
	page.on('worker', worker => {
		if (worker.url().includes('geometry')) geometryWorkerStarted = true;
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const panel = page.locator('#profile-panel');
	const map = page.locator('[data-globe]');
	await map.scrollIntoViewIfNeeded();
	const heightBefore = await panel.evaluate(element => element.scrollHeight);
	await expect(map).toHaveAttribute('data-state', /travelling|ready/);
	expect(geometryWorkerStarted).toBe(true);
	expect(await panel.evaluate(element => element.scrollHeight)).toBe(heightBefore);
	const mainThreadGeography = await page.evaluate(() =>
		performance.getEntriesByType('resource').filter(entry => entry.name.includes('countries.geojson'))
	);
	expect(mainThreadGeography).toHaveLength(0);
	const bounds = await panel.boundingBox();
	if (!bounds) throw new Error('Profile bounds unavailable');
	await page.mouse.move(bounds.x + 30, bounds.y + bounds.height / 2);
	// Sample the Profile scroll position every animation frame for a second while the wheel scrolls up
	const samplesPromise = panel.evaluate(async element => {
		const samples: number[] = [];
		const end = performance.now() + 1000;
		while (performance.now() < end) {
			await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
			samples.push(element.scrollTop);
		}
		return samples;
	});
	await page.mouse.wheel(0, -400);
	const samples = await samplesPromise;
	expect(samples.at(-1)).toBeLessThan(samples[0]);
	// Scrolling up never jumps back down by more than a pixel between frames
	for (let i = 1; i < samples.length; i++) expect(samples[i]).toBeLessThanOrEqual(samples[i - 1] + 1);
});
