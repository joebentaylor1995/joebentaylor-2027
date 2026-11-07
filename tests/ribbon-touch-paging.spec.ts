// Imports
// ------------
import { expect, type Frame, type Page, test } from '@playwright/test';
import { readyProjects } from './helpers/ready-projects';

// Helpers
// ------------
// Globals of the standalone ribbon document, declared so the page.evaluate bodies type-check
declare const ready: boolean;
declare let target: number;

// Touch phone with reduced motion, so `position` lands on `target` at once and the idle drift stays still
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true });
test.beforeEach(async ({ page }) => readyProjects(page));

const openRibbon = async (page: Page): Promise<Frame> => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/projects/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	const embedded = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(embedded.locator('#slide-number')).toHaveText(/01 \/ \d+/, { timeout: 30_000 });
	const renderer = page.frames().find(frame => frame.url().includes('/projects-ribbon/'));
	if (!renderer) throw new Error('Projects renderer did not mount');
	await renderer.waitForFunction(() => ready);
	return renderer;
};

// One vertical touch gesture on the stage: `steps` moves of `stepY` px each, `holdMs` still before
// lifting (a held finger has no flick), ending in `end` (pointerup or pointercancel)
type Gesture = {
	steps: number;
	stepY: number;
	holdMs: number;
	end?: 'pointerup' | 'pointercancel';
	pointerId?: number;
};
const swipe = (renderer: Frame, gesture: Gesture) =>
	renderer.evaluate(async ({ steps, stepY, holdMs, end = 'pointerup', pointerId = 1 }) => {
		const stage = document.querySelector('#stage') as HTMLCanvasElement;
		const fire = (type: string, y: number) =>
			stage.dispatchEvent(
				new PointerEvent(type, {
					bubbles: true,
					pointerId,
					pointerType: 'touch',
					isPrimary: true,
					clientX: 195,
					clientY: y,
				})
			);
		let y = 600;
		fire('pointerdown', y);
		for (let i = 0; i < steps; i++) {
			y -= stepY;
			fire('pointermove', y);
			await new Promise(resolve => setTimeout(resolve, 16));
		}
		await new Promise(resolve => setTimeout(resolve, holdMs));
		fire(end, y);
	}, gesture);

// Where the ribbon comes to rest once the snap has had time to run
const settled = async (renderer: Frame) => {
	await renderer.waitForTimeout(400);
	// `+ 0` folds -0 into 0 so a spring-back to slide 0 compares equal
	return renderer.evaluate(() => target + 0);
};

// Tests
// ------------
// Protects phone paging: every swipe moves exactly one project, however far or fast it travels, and an
// interrupted gesture still comes to rest on a whole project.
test('a long, slow touch drag moves exactly one project', async ({ page }) => {
	const renderer = await openRibbon(page);
	const start = await renderer.evaluate(() => target);
	await swipe(renderer, { steps: 30, stepY: 20, holdMs: 200 });
	expect(await settled(renderer)).toBe(start - 1);
});

test('a short, quick flick moves exactly one project', async ({ page }) => {
	const renderer = await openRibbon(page);
	const start = await renderer.evaluate(() => target);
	await swipe(renderer, { steps: 3, stepY: 15, holdMs: 0 });
	expect(await settled(renderer)).toBe(start - 1);
});

test('a tiny, slow nudge springs back to the same project', async ({ page }) => {
	const renderer = await openRibbon(page);
	const start = await renderer.evaluate(() => target);
	await swipe(renderer, { steps: 2, stepY: 10, holdMs: 200 });
	expect(await settled(renderer)).toBe(start);
});

test('a cancelled touch still comes to rest on a whole project', async ({ page }) => {
	const renderer = await openRibbon(page);
	await swipe(renderer, { steps: 6, stepY: 20, holdMs: 200, end: 'pointercancel' });
	expect(Number.isInteger(await settled(renderer))).toBe(true);
});

test('a second finger does not add to the first one’s drag', async ({ page }) => {
	const renderer = await openRibbon(page);
	const start = await renderer.evaluate(() => target);
	await renderer.evaluate(async () => {
		const stage = document.querySelector('#stage') as HTMLCanvasElement;
		const fire = (type: string, pointerId: number, y: number) =>
			stage.dispatchEvent(
				new PointerEvent(type, { bubbles: true, pointerId, pointerType: 'touch', clientX: 195, clientY: y })
			);
		fire('pointerdown', 1, 600);
		fire('pointerdown', 2, 600);
		for (let i = 1; i <= 20; i++) {
			fire('pointermove', 1, 600 - i * 20);
			fire('pointermove', 2, 600 - i * 20);
			await new Promise(resolve => setTimeout(resolve, 16));
		}
		await new Promise(resolve => setTimeout(resolve, 200));
		fire('pointerup', 2, 200);
		fire('pointerup', 1, 200);
	});
	expect(await settled(renderer)).toBe(start - 1);
});
