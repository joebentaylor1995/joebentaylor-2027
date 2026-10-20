import { expect, test } from '@playwright/test';

declare const featuredProjects: { name: string; isReady: boolean }[];
declare const ready: boolean;
declare const posterCache: Map<string, Promise<HTMLImageElement>>;

test('published ribbon contains the four locked Sanity case studies', async ({ page, request }) => {
	const response = await request.get('/api/projects-ribbon/');
	expect(response.ok()).toBe(true);
	const catalogue = await response.json();
	expect(
		catalogue.featured.map((project: { name: string; isReady: boolean }) => ({
			name: project.name,
			isReady: project.isReady,
		}))
	).toEqual([
		{ name: 'Pocketchange', isReady: false },
		{ name: 'Forge', isReady: false },
		{ name: 'Featured 02', isReady: false },
		{ name: 'ONYX', isReady: false },
	]);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/projects/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	const iframe = page.locator('iframe[title="Interactive projects"]');
	await expect(iframe).toHaveAttribute('data-ribbon-ready', 'true', { timeout: 45_000 });
	const renderer = page.frames().find(frame => frame.url().includes('/projects-ribbon/'));
	if (!renderer) throw Error('Missing ribbon');
	await renderer.waitForFunction(() => ready);
	const decodedPosters = await renderer.evaluate(async () =>
		Promise.all([...posterCache.values()].map(async image => (await image).src))
	);
	expect(decodedPosters).toEqual(catalogue.featured.map((project: { poster: string }) => project.poster));
	expect(await renderer.evaluate(() => featuredProjects.map(({ name, isReady }) => ({ name, isReady })))).toEqual(
		catalogue.featured.map((project: { name: string; isReady: boolean }) => ({
			name: project.name,
			isReady: project.isReady,
		}))
	);
	const frame = page.frameLocator('iframe[title="Interactive projects"]');
	await expect(frame.locator('#dots button')).toHaveCount(4);
	const canvas = frame.locator('#stage');
	await canvas.focus();
	await expect(canvas).toHaveAttribute('aria-disabled', 'true');
	await expect(frame.getByRole('tooltip')).toHaveText('Coming soon');
	await canvas.press('Enter');
	await expect(page).toHaveURL(/\/projects\/$/);
	await expect(page.locator('[data-project-handoff]')).toHaveCount(0);
	await page.screenshot({ path: 'output/playwright/live-catalogue-verified.png' });
});
