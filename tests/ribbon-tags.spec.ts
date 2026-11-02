// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects the ribbon subtitle: tags show in CMS order as a comma separated list, and a project with no tags shows
// no empty subtitle.
test('ribbon displays selected tags in order and hides empty subtitles', async ({ page }) => {
	// Give the first project three tags and the second none
	await page.route('**/api/projects-ribbon/', async route => {
		const response = await route.fetch();
		const data = await response.json();
		data.featured[0].tags = ['Development', 'Branding', 'UI/UX'];
		data.featured[1].tags = [];
		await route.fulfill({ response, json: data });
	});
	// Load the standalone ribbon document directly
	await page.goto('/projects-ribbon/index.html');
	await expect(page.locator('.project-services')).toHaveText('Development, Branding, UI/UX');
	await page.locator('#stage').press('ArrowRight');
	await expect(page.locator('#slide-number')).toContainText('02 /');
	await expect(page.locator('.project-services')).toBeHidden();
	await page.locator('#stage').press('ArrowLeft');
	await expect(page.locator('.project-services')).toBeVisible();
	await expect(page.locator('.project-services')).toHaveText('Development, Branding, UI/UX');
});
