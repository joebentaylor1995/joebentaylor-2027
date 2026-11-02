// Imports
// ------------
import { expect, type Page, test } from './helpers/test';

// Helpers
// ------------
// Globals of the standalone ribbon document, declared so the page.evaluate bodies type-check
declare const ready: boolean;
declare const introduction: { active: boolean };
declare const gridView: {
	mix: number;
	hitTest(x: number, y: number): { project: { href?: string } } | null;
};

// Fake project catalogue: one case study (readiness set by the test, or absent), one marked not ready, and
// one external link
const catalogue = (isReady?: boolean) => {
	const featured = [
		{
			id: 'case-study',
			name: 'Pocketchange',
			type: 'image',
			poster: '/projects-ribbon/assets/featured/02.jpg',
			href: '/projects/pocketchange',
			...(isReady !== undefined && { isReady }),
		},
		{
			id: 'second-case-study',
			name: 'Second case study',
			type: 'image',
			poster: '/projects-ribbon/assets/featured/02.jpg',
			href: '/projects/second-case-study',
			isReady: false,
		},
	];
	return {
		featured,
		all: [
			...featured,
			{
				id: 'external-project',
				name: 'External project',
				type: 'image',
				poster: '/projects-ribbon/assets/featured/02.jpg',
				href: 'https://example.com/project',
				isReady: false,
			},
		],
	};
};

// Opens Projects with the fake catalogue and waits for the ribbon intro to finish
const openRibbon = async (page: Page, isReady?: boolean) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.route('**/api/projects-ribbon/', route => route.fulfill({ json: catalogue(isReady) }));
	await page.goto('/projects/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	const frame = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(frame.locator('#stage')).toBeVisible({ timeout: 20000 });
	const renderer = page.frames().find(item => item.url().includes('/projects-ribbon/'));
	if (!renderer) throw new Error('Missing ribbon frame');
	await renderer.waitForFunction(() => ready && !introduction.active);
	return { frame, renderer };
};

// Tests
// ------------
// Protects unready case studies: hovering or focusing one shows Coming soon, it is announced as disabled, and
// click, Enter and Space do not navigate. Covers an explicit false and a missing readiness flag.
for (const readiness of [false, undefined]) {
	test(`a case study with readiness ${String(readiness)} shows Coming soon on hover and focus`, async ({ page }) => {
		const { frame } = await openRibbon(page, readiness);
		const canvas = frame.locator('#stage');
		await expect(page.getByRole('link', { name: 'Projects', exact: true })).toHaveAttribute('href', '/projects/');
		await expect(page.locator('header')).not.toContainText('Coming soon');

		// Pointer
		await canvas.hover({ position: { x: 720, y: 450 } });
		await expect(frame.getByRole('tooltip')).toHaveText('Coming soon');
		await expect(canvas).toHaveCSS('cursor', 'grab');
		await canvas.click({ position: { x: 720, y: 450 }, force: true });
		await expect(page).toHaveURL(/\/projects\/$/);
		await canvas.press('Escape');
		await expect(frame.getByRole('tooltip')).toBeHidden();

		// Keyboard
		await canvas.press('Tab');
		await canvas.focus();
		await expect(frame.getByRole('tooltip')).toBeVisible();
		await expect(canvas).toHaveAttribute('aria-describedby', 'hover-title');
		await expect(canvas).toHaveAttribute('aria-disabled', 'true');
		await expect(canvas).toHaveAttribute('aria-label', 'Pocketchange — coming soon');
		await canvas.press('Enter');
		await canvas.press('Space');
		await expect(page).toHaveURL(/\/projects\/$/);
		await expect(frame.getByRole('tooltip')).toHaveText('Coming soon');
		await expect(page.locator('[data-project-handoff]')).toHaveCount(0);
	});
}

// Protects the grid view: it uses the same readiness rules, and external listings still open in a new tab.
test('the grid shares case-study readiness and keeps external links openable', async ({ page }) => {
	const { frame, renderer } = await openRibbon(page, false);
	await frame.getByRole('button', { name: /All projects/ }).click();
	await renderer.waitForFunction(() => gridView.mix === 1);
	const canvas = frame.locator('#stage');
	await canvas.focus();
	await expect(frame.getByRole('tooltip')).toHaveText('Coming soon');
	await canvas.press('Enter');
	await expect(page).toHaveURL(/\/projects\/$/);
	// Find a grid position that hits the external project by sampling the ribbon hit-test every 30px
	const external = await renderer.evaluate(() => {
		for (let y = 160; y < innerHeight - 100; y += 30) {
			for (let x = 30; x < innerWidth - 30; x += 30) {
				if (gridView.hitTest(x, y)?.project.href === 'https://example.com/project') return { x, y };
			}
		}
		return null;
	});
	if (!external) throw new Error('External listing did not render');
	await canvas.hover({ position: external });
	await expect(frame.getByRole('tooltip')).toHaveText('View Offsite');
	await expect(canvas).toHaveCSS('cursor', 'pointer');
	const popupPromise = page.waitForEvent('popup');
	await canvas.click({ position: external });
	const popup = await popupPromise;
	await expect(popup).toHaveURL('https://example.com/project');
	await popup.close();
	await expect(page).toHaveURL(/\/projects\/$/);
});

// Protects the happy path: a ready case study shows View and opens from the keyboard.
test('a ready case study still opens from the ribbon with the keyboard', async ({ page }) => {
	const { frame } = await openRibbon(page, true);
	await frame.locator('#stage').focus();
	await expect(frame.getByRole('tooltip')).toHaveText('View');
	await expect(frame.locator('#stage')).toHaveAttribute('aria-disabled', 'false');
	await frame.locator('#stage').press('Enter');
	await expect(page).toHaveURL(/\/projects\/pocketchange\/$/, { timeout: 20000 });
});

// Touch devices have no hover, so the tooltip comes from taps.
test.describe('touch', () => {
	test.use({ hasTouch: true, viewport: { width: 440, height: 780 } });
	// A tap on an unready case study shows Coming soon and does not navigate.
	test('tapping an unready case study shows Coming soon without navigating', async ({ page }) => {
		const { frame } = await openRibbon(page, false);
		await frame.locator('#stage').tap({ position: { x: 220, y: 390 } });
		await expect(frame.getByRole('tooltip')).toHaveText('Coming soon');
		await expect(frame.getByRole('tooltip')).toBeVisible();
		await expect(page).toHaveURL(/\/projects\/$/);
		await expect(page.locator('[data-project-handoff]')).toHaveCount(0);
	});
	// On a tablet grid, the tooltip survives the following render frames.
	test('a tablet grid tap keeps the Coming soon tooltip visible after rendering', async ({ page }) => {
		await page.setViewportSize({ width: 1024, height: 768 });
		const { frame, renderer } = await openRibbon(page, false);
		await frame.getByRole('button', { name: /All projects/ }).tap();
		await renderer.waitForFunction(() => gridView.mix === 1);
		await frame.locator('#stage').tap({ position: { x: 512, y: 384 } });
		await renderer.evaluate(
			() => new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
		);
		await expect(frame.getByRole('tooltip')).toHaveText('Coming soon');
		await expect(frame.getByRole('tooltip')).toBeVisible();
		await expect(page).toHaveURL(/\/projects\/$/);
	});
});
