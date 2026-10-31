import { expect, test } from '@playwright/test';
import { readyProjects } from './helpers/ready-projects';

// These bindings live in the ribbon iframe.
declare const ready: boolean;
declare const introduction: { active: boolean };
declare const projectTransition: {
	active: boolean;
	settled: boolean;
	returning: boolean;
	meshProgress: number;
	fill: { duration: number; stagger: number; ease: (t: number) => number };
};
declare const pickFeatured: (x: number, y: number) => { isReady?: boolean };

test('the fill sliders reach the ribbon and the preview flies back without navigating', async ({ page }) => {
	await readyProjects(page);
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/projects/?globalSettings');
	await page.getByRole('button', { name: 'Accept Necessary' }).dispatchEvent('click');
	const panel = page.getByRole('complementary', { name: 'Global settings' });
	await expect(panel).toBeVisible();
	const frame = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(frame.locator('#stage')).toBeVisible({ timeout: 20000 });
	const renderer = page.frames().find(item => item.url().includes('/projects-ribbon/'));
	if (!renderer) throw new Error('Missing ribbon');
	await renderer.waitForFunction(() => ready && !introduction.active);

	await panel.getByRole('slider', { name: 'Fill duration (ms)' }).fill('600');
	await panel.getByRole('slider', { name: 'Edge lag' }).fill('0.5');
	await panel.getByRole('button', { name: 'Play fill' }).click();
	await renderer.waitForFunction(() => projectTransition.active);
	expect(await renderer.evaluate('projectTransition.fill.duration')).toBe(600);
	expect(await renderer.evaluate('projectTransition.fill.stagger')).toBe(0.5);
	await renderer.waitForFunction(() => projectTransition.returning, null, { timeout: 10000 });
	await renderer.waitForFunction(() => !projectTransition.active, null, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toMatch(/^\/projects\/?$/);

	// The timeline holds the fill at a point and flies back when let go
	await panel.getByRole('checkbox', { name: 'Hold the fill on its timeline' }).check();
	await panel.getByRole('slider', { name: 'Timeline' }).fill('30');
	await renderer.waitForFunction(() => projectTransition.active && projectTransition.meshProgress === 0.3);
	await page.waitForTimeout(800);
	expect(await renderer.evaluate('projectTransition.settled')).toBeFalsy();
	expect(await renderer.evaluate('projectTransition.meshProgress')).toBe(0.3);
	await panel.getByRole('slider', { name: 'Edge lag' }).fill('0.2');
	await expect.poll(() => renderer.evaluate('projectTransition.fill.stagger')).toBe(0.2);
	await panel.getByRole('combobox', { name: 'Fill easing' }).selectOption('sine.inOut');
	await expect.poll(() => renderer.evaluate('projectTransition.fill.ease(0.25)')).toBeCloseTo(0.1464, 3);
	await expect(panel.getByRole('slider', { name: 'Settle softness' })).toBeDisabled();
	await panel.getByRole('checkbox', { name: 'Hold the fill on its timeline' }).uncheck();
	await renderer.waitForFunction(() => !projectTransition.active, null, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toMatch(/^\/projects\/?$/);

	await panel.getByRole('button', { name: 'Reset fill' }).click();
	await expect(panel.getByRole('slider', { name: 'Fill duration (ms)' })).toHaveValue('850');
	expect(errors).toEqual([]);
});

test('the timeline and preview work on a project that is not ready', async ({ page }) => {
	await page.route('**/api/projects-ribbon/', async route => {
		const response = await route.fetch();
		const data = (await response.json()) as { featured: { isReady?: boolean }[] };
		for (const [index, project] of data.featured.entries()) project.isReady = index === 0;
		await route.fulfill({ response, json: data });
	});
	await page.goto('/projects/?globalSettings');
	await page.getByRole('button', { name: 'Accept Necessary' }).dispatchEvent('click');
	const panel = page.getByRole('complementary', { name: 'Global settings' });
	const frame = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(frame.locator('#stage')).toBeVisible({ timeout: 20000 });
	const renderer = page.frames().find(item => item.url().includes('/projects-ribbon/'));
	if (!renderer) throw new Error('Missing ribbon');
	await renderer.waitForFunction(() => ready && !introduction.active);
	await page.mouse.move(500, 450);
	await page.mouse.wheel(0, 900);
	await renderer.waitForFunction(() => !pickFeatured(innerWidth / 2, innerHeight / 2).isReady);

	await panel.getByRole('checkbox', { name: 'Hold the fill on its timeline' }).check();
	await renderer.waitForFunction(() => projectTransition.active && projectTransition.meshProgress === 0.5);
	await panel.getByRole('checkbox', { name: 'Hold the fill on its timeline' }).uncheck();
	await renderer.waitForFunction(() => !projectTransition.active, null, { timeout: 10000 });

	await panel.getByRole('button', { name: 'Play fill' }).click();
	await renderer.waitForFunction(() => projectTransition.active);
	await renderer.waitForFunction(() => !projectTransition.active, null, { timeout: 10000 });
	expect(new URL(page.url()).pathname).toMatch(/^\/projects\/?$/);
});
