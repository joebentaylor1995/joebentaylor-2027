// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the hero scene against slow failures: left idle, swept with the pointer and resized, it stays
// mounted, the entrance stays complete and no console error or WebGL INVALID warning appears.
test('scene remains ready and error-free through idle, pointer movement and resize', async ({ page }) => {
	// WebGL INVALID warnings are logged as console messages, not errors
	const errors: string[] = [];
	page.on('console', message => {
		if (message.type() === 'error' || /WebGL.*INVALID/.test(message.text())) errors.push(message.text());
	});
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/');
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete', { timeout: 15000 });
	const scene = page.locator('[data-liquid-ready="true"]');
	await expect(scene).toHaveCount(1);

	// Sit idle for a few seconds, then sweep the pointer back and forth
	await page.waitForTimeout(3000);
	for (let i = 0; i < 8; i++) {
		await page.mouse.move(i % 2 ? 100 : 1000, 250 + i * 30, { steps: 12 });
		await expect(scene).toHaveCount(1);
	}

	// Resize down and up, with a brief wait before checking the entrance state each time
	await page.setViewportSize({ width: 800, height: 850 });
	await page.waitForTimeout(150);
	expect(await page.locator('[data-hero-content]').getAttribute('data-entrance')).toBe('complete');
	await page.setViewportSize({ width: 1400, height: 850 });
	await page.waitForTimeout(150);
	expect(await page.locator('[data-hero-content]').getAttribute('data-entrance')).toBe('complete');
	await expect(scene).toHaveCount(1);
	expect(errors).toEqual([]);
});
