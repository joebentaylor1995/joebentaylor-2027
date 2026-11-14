// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the ribbon subtitle: tags show beneath the project name in CMS order as a comma separated list, and a
// project with no tags keeps the line's height with a blank (non-breaking space) so the name never jumps.
test('ribbon displays selected tags in order and keeps the line for empty subtitles', async ({ page }) => {
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
	const tags = page.locator('.project-services');
	const title = page.locator('#slide-title');
	// The footer is bottom-anchored, so the name's bottom edge is what moves if the tags line collapses (its top
	// would also move for a name that wraps to two lines, which is not a jump)
	const titleBottom = async () => {
		const box = await title.boundingBox();
		if (!box) throw new Error('Missing slide title');
		return box.y + box.height;
	};
	await expect(tags).toHaveText('Development, Branding, UI/UX');
	await expect(tags).toBeVisible();
	const restingBottom = await titleBottom();

	// No tags: the line stays, blank, and the name above it holds its place
	await page.locator('#stage').press('ArrowRight');
	await expect(page.locator('#slide-number')).toContainText('02 /');
	await expect(tags).toHaveText(/^\u00a0$/);
	await expect(tags).toBeVisible();
	expect(await titleBottom()).toBe(restingBottom);

	// Back to the first project's tags
	await page.locator('#stage').press('ArrowLeft');
	await expect(page.locator('#slide-number')).toContainText('01 /');
	await expect(tags).toBeVisible();
	await expect(tags).toHaveText('Development, Branding, UI/UX');
});
