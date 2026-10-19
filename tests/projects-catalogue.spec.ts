import { expect, test } from '@playwright/test';

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

for (const unavailable of [false, true]) {
	test(`an ${unavailable ? 'unavailable' : 'empty'} catalogue never loads demo projects`, async ({ page }) => {
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
