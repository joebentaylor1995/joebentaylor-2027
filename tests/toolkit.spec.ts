import { createPhysics } from '../src/components/Profile/Usps/Toolkit/physics';
import { expect, test } from './helpers/test';

test('tools enter from above, collide with the floor, drag, release and stay contained after resize', () => {
	const world = createPhysics(
		500,
		325,
		Array.from({ length: 6 }, (_, index) => ({
			x: 70 + index * 60,
			y: 0,
			width: 98,
			height: 98,
			label: String(index),
		})),
		{ intro: true }
	);
	expect(world.bodies.every(body => body.bounds.max.y < 0)).toBe(true);
	for (let step = 0; step < 900; step++) world.step();
	expect(world.bodies.every(body => body.bounds.max.y < 326 && body.bounds.min.y >= -1)).toBe(true);
	const body = world.bodies[0];
	world.grab(body.position, 0);
	world.move({ x: 250, y: 65 });
	for (let step = 0; step < 180; step++) world.step();
	expect(body.position.y).toBeLessThan(100);
	world.release();
	for (let step = 0; step < 900; step++) world.step();
	expect(body.position.y).toBeGreaterThan(100);
	world.resize(300, 325);
	for (let step = 0; step < 900; step++) world.step();
	expect(world.bodies.every(tile => tile.bounds.min.x >= 6 && tile.bounds.max.x <= 294)).toBe(true);
	world.destroy();
});

for (const width of [1440, 440, 2560]) {
	test(`both toolkit sets render and drag independently at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.emulateMedia({ reducedMotion: 'reduce' });
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		await page.goto('/');
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		for (const [label, count] of [
			['Design toolkit', 6],
			['Development toolkit', 5],
		] as const) {
			const toolkit = page.locator(`[data-toolkit="${label}"]`);
			await toolkit.scrollIntoViewIfNeeded();
			await expect(toolkit).toHaveAttribute('data-state', 'ready');
			await expect(toolkit).toHaveAttribute('data-renderer', 'webgl');
			await expect(toolkit.locator('button')).toHaveCount(count);
			const tile = toolkit.locator('button').last();
			const scale = width > 1600 ? width / 1600 : 1;
			await expect(tile).toHaveCSS('border-radius', `${16 * scale}px`);
			expect(await tile.evaluate(element => parseFloat(getComputedStyle(element).width))).toBeCloseTo(
				98 * scale,
				1
			);
			await expect(toolkit).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
			const consent = page.getByRole('button', { name: 'Accept Necessary', exact: true });
			if (await consent.isVisible()) await consent.click();
			const bounds = await tile.boundingBox();
			const area = await toolkit.boundingBox();
			if (!bounds || !area) throw new Error('Toolkit geometry missing');
			await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
			await page.mouse.down();
			await expect(tile).toBeFocused();
			await page.mouse.move(area.x + area.width / 2, area.y + 50, { steps: 20 });
			await expect.poll(async () => (await tile.boundingBox())?.y).toBeLessThan(area.y + 60);
			const held = await tile.boundingBox();
			await page.mouse.up();
			await page.screenshot({ path: `test-results/toolkit-${label.split(' ')[0]}-${width}.png` });
			await expect.poll(async () => (await tile.boundingBox())?.y).toBeGreaterThan((held?.y ?? area.y) + 15);
		}
		expect(errors).toEqual([]);
		await page.getByRole('button', { name: 'Close profile', exact: true }).press('Escape');
		for (const toolkit of await page.locator('[data-toolkit]').all()) {
			await expect(toolkit).toHaveAttribute('data-state', 'loading');
			await expect(toolkit.locator('canvas')).toHaveCount(0);
			await expect(toolkit.locator('button').first()).toBeDisabled();
		}
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		const reopened = page.locator('[data-toolkit="Design toolkit"]');
		await reopened.scrollIntoViewIfNeeded();
		await expect(reopened).toHaveAttribute('data-state', 'ready');
		await expect(reopened.locator('canvas')).toHaveCount(1);
	});
}
