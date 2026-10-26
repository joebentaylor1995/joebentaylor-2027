import type { Page } from '@playwright/test';
import { fetchCatalogue } from './catalogue';

// Navigation tests need published, ready case studies without changing CMS content.
export const readyProjects = async (page: Page) => {
	await page.route('**/api/projects-ribbon/', async route => {
		const { response, data } = await fetchCatalogue(route);
		for (const project of [...data.featured, ...data.all]) {
			if (project.href?.startsWith('/projects/')) project.isReady = true;
		}
		await route.fulfill({ response, json: data });
	});
};
