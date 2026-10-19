import type { Page } from '@playwright/test';

type CatalogueProject = { href?: string; isReady?: boolean };

// Navigation tests need published, ready case studies without changing CMS content.
export const readyProjects = async (page: Page) => {
	await page.route('**/api/projects-ribbon/', async route => {
		const response = await route.fetch();
		const data = (await response.json()) as {
			featured: CatalogueProject[];
			all: CatalogueProject[];
		};
		for (const project of [...data.featured, ...data.all]) {
			if (project.href?.startsWith('/projects/')) project.isReady = true;
		}
		await route.fulfill({ response, json: data });
	});
};
