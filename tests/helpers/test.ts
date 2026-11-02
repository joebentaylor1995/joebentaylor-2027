// Test entry point
// ------------
// NOTE • Specs import `test`/`expect` from here rather than '@playwright/test'
// so quarantined tests (tests/quarantine.ts) are marked `fixme` with their
// reason — skipped, but still listed in the report — and every browser context
// has a project catalogue even without Sanity (tests/helpers/catalogue.ts).
// A spec's own page.route() for the catalogue still takes precedence.

// Imports
// ------------
import { basename } from 'node:path';
import { test as base } from '@playwright/test';
import { quarantine } from '../quarantine';
import { fetchCatalogue } from './catalogue';

// Exports
// ------------
export * from '@playwright/test';

export const test = base.extend<{ quarantined: undefined }>({
	context: async ({ context }, use) => {
		await context.route('**/api/projects-ribbon/', async route => {
			const { response, data } = await fetchCatalogue(route);
			await route.fulfill({ response, json: data });
		});
		await use(context);
	},
	quarantined: [
		// biome-ignore lint/correctness/noEmptyPattern: Playwright fixtures must destructure their dependencies
		async ({}, use, testInfo) => {
			const reason = quarantine.get(`${basename(testInfo.file)} › ${testInfo.title}`);
			testInfo.fixme(reason !== undefined, `Quarantined — ${reason}`);
			await use(undefined);
		},
		{ auto: true },
	],
});
