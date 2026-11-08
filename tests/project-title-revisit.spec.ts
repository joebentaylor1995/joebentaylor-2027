// Imports
// ------------

import { readyProjects } from './helpers/ready-projects';
import { expect, test } from './helpers/test';

// Helpers
// ------------
// Globals of the standalone ribbon document, declared so the page.evaluate bodies type-check
declare const ready: boolean;
declare const introduction: { active: boolean };
declare function returningToFeatured(): boolean;

// Tests
// ------------
// Protects revisiting a case study from the cached ribbon: the title wave plays again on the second visit, not
// only the first.
test('ribbon title wave reveal replays when reopening a cached project', async ({ page }) => {
	await readyProjects(page);
	await page.goto('/projects/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	// Open a project, then go back, twice
	for (let visit = 0; visit < 2; visit++) {
		const ribbon = page.frameLocator('iframe[title="Interactive projects"]');
		await expect(ribbon.locator('#stage')).toBeVisible({ timeout: 20000 });
		const frame = page.frames().find(item => item.url().includes('/projects-ribbon/'));
		if (!frame) throw new Error('Missing ribbon frame');
		await frame.waitForFunction(() => ready && !introduction.active && !returningToFeatured());
		await ribbon.locator('#stage').press('Enter');
		await expect(page).toHaveURL(/\/projects\/[^/]+\/?$/, { timeout: 20000 });
		await page.waitForFunction(
			() => {
				const title = Array.from(
					document.querySelectorAll<HTMLElement>('[data-project-hero] h1 [data-reveal-variant="wave"]')
				).find(element => element.getBoundingClientRect().width > 0);
				return (
					title?.dataset.waveState === 'playing' &&
					Number.parseFloat(title.style.getPropertyValue('--tfw-fill')) > 0 &&
					!document.querySelector('[data-project-handoff]')
				);
			},
			null,
			{ timeout: 5000 }
		);
		await expect(page.locator('[data-project-hero] h1 [data-reveal-variant="wave"]:visible')).toHaveAttribute(
			'data-wave-state',
			'complete'
		);
		await page.goBack();
		await expect(page).toHaveURL(/\/projects\/$/);
	}
});
