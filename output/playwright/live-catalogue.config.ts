import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: '.',
	testMatch: 'live-catalogue.spec.ts',
	outputDir: '../../test-results/live-catalogue',
	timeout: 60_000,
	use: {
		...devices['Desktop Chrome'],
		viewport: { width: 1440, height: 900 },
		baseURL: process.env.CATALOGUE_URL,
	},
});
