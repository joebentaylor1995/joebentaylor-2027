import { readyProjects } from './helpers/ready-projects';
import { expect, test } from './helpers/test';

declare const ready: boolean;
declare const introduction: { active: boolean };
declare const gridView: { mix: number };
declare function returningToFeatured(): boolean;

test.beforeEach(async ({ page }) => readyProjects(page));

test('projects retains the ribbon, grid, settings and host navigation', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const errors: string[] = [];
	page.on('pageerror', error => errors.push(error.message));
	await page.goto('/projects/?projectSettings');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	const embedded = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(embedded.locator('#slide-number')).toHaveText(/01 \/ \d+/, { timeout: 30_000 });
	const renderer = page.frames().find(frame => frame.url().includes('/projects-ribbon/'));
	if (!renderer) throw new Error('Projects renderer did not mount');
	await renderer.waitForFunction(() => ready);
	await expect(embedded.locator('#error')).toBeHidden();
	await expect(embedded.locator('header')).toHaveCount(0);
	await expect(page.getByRole('link', { name: 'Projects', exact: true })).toHaveAttribute('href', /\/projects\/?$/);
	await expect(page.getByRole('link', { name: 'Go to home page' }).locator('svg')).toHaveCSS(
		'fill',
		'rgb(255, 255, 255)'
	);
	await embedded.getByRole('button', { name: 'Close settings' }).click();
	await embedded.getByRole('button', { name: /All projects/ }).click();
	await expect(embedded.locator('body')).toHaveClass(/all-projects/);
	await embedded.getByRole('button', { name: 'Featured', exact: true }).click();
	await expect(embedded.locator('body')).not.toHaveClass(/all-projects/);
	await embedded.locator('#stage').press('s');
	await expect(embedded.getByRole('heading', { name: 'Shape the view' })).toBeVisible();
	await embedded.getByRole('button', { name: 'Close settings' }).click();
	await renderer.waitForFunction(() => gridView.mix === 0);
	await page.screenshot({ path: 'test-results/projects-desktop.png' });
	expect(errors).toEqual([]);
});

test('mobile shows only the featured case studies in the vertical stacked ribbon', async ({ page }) => {
	await page.setViewportSize({ width: 440, height: 780 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/projects/?projectSettings');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	const embedded = page.frameLocator('iframe[title="Interactive projects"]');
	const { featured } = await (await page.request.get('/api/projects-ribbon/')).json();
	await expect(embedded.locator('#slide-number')).toHaveText(`01 / ${String(featured.length).padStart(2, '0')}`, {
		timeout: 30_000,
	});
	await expect(embedded.locator('.view-switch')).toBeHidden();
	await expect(embedded.locator('#vertical')).toBeChecked();
	await expect(embedded.locator('#stacked')).toBeChecked();
	await embedded.getByRole('button', { name: 'Close settings' }).click();
	await page.screenshot({ path: 'test-results/projects-mobile.png' });
	await embedded.locator('#stage').click({ position: { x: 220, y: 390 } });
	await expect(page).toHaveURL(/\/projects\/pocketchange\/$/);
	await expect(page.getByRole('heading', { name: 'Pocketchange', exact: true })).toBeVisible();
});

test('featured and grid selections open the Pocketchange template and support browser Back', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/projects/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	const embedded = page.frameLocator('iframe[title="Interactive projects"]');
	for (const grid of [false, true]) {
		const renderer = page.frames().find(frame => frame.url().includes('/projects-ribbon/'));
		if (!renderer) throw new Error('Projects renderer did not mount');
		await renderer.waitForFunction(() => ready && !introduction.active && !returningToFeatured());
		if (grid) {
			await embedded.getByRole('button', { name: /All projects/ }).click();
			await renderer.waitForFunction(() => gridView.mix === 1);
		}
		await embedded.locator('#stage').click({ position: { x: 720, y: 450 } });
		await expect(page).toHaveURL(/\/projects\/pocketchange\/$/);
		await expect(page.getByRole('heading', { name: 'Pocketchange', exact: true })).toBeVisible();
		await expect(page.locator('header')).toHaveAttribute('data-tone', 'light');
		await page.goBack();
		await expect(page).toHaveURL(/\/projects\/$/);
		await expect(embedded.locator('#stage')).toBeVisible({ timeout: 15000 });
	}
});
