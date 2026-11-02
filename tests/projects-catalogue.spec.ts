// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects the Projects API: every entry is a real CMS project with an id and an explicit ready flag,
// so the ribbon never has to guess whether a case study exists.
test('the server catalogue contains only CMS projects with explicit readiness', async ({ request }) => {
	const response = await request.get('/api/projects-ribbon/');
	expect(response.ok()).toBe(true);
	const catalogue = (await response.json()) as {
		featured: { id?: string; isReady?: boolean }[];
		all: { id?: string; isReady?: boolean }[];
	};
	for (const project of [...catalogue.featured, ...catalogue.all]) {
		expect(project.id).toEqual(expect.any(String));
		expect(project.isReady).toEqual(expect.any(Boolean));
	}
});

// Protects the empty and failing catalogue states: the ribbon shows a clear message and never falls back to the
// bundled demo projects.
for (const unavailable of [false, true]) {
	test(`an ${unavailable ? 'unavailable' : 'empty'} catalogue never loads demo projects`, async ({ page }) => {
		// Demo data files that must never be requested
		const demoRequests: string[] = [];
		page.on('request', request => {
			if (/\/projects-ribbon\/(featured|projects)\.json/.test(request.url())) demoRequests.push(request.url());
		});
		await page.emulateMedia({ reducedMotion: 'reduce' });
		await page.route('**/api/projects-ribbon/', route =>
			route.fulfill({ status: unavailable ? 503 : 200, json: { featured: [], all: [] } })
		);
		await page.goto('/projects/');
		const frame = page.frameLocator('iframe[title="Interactive projects"]');
		await expect(frame.locator('#error')).toHaveText(
			unavailable
				? 'Project items could not load. Please reload.'
				: 'No projects are available yet. Please check back soon.'
		);
		await expect(frame.locator('#dots button')).toHaveCount(0);
		expect(demoRequests).toEqual([]);
	});
}
