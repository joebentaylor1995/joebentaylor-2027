import { defineConfig } from '@playwright/test';
import base from '../../playwright.config';

export default defineConfig({
	...base,
	testDir: '../../tests',
	outputDir: '../../test-results/profile-production',
	webServer: undefined,
	use: {
		...base.use,
		baseURL: 'http://localhost:3000',
		launchOptions: {
			...base.use?.launchOptions,
			args: ['--host-resolver-rules=MAP localhost:3000 127.0.0.1:3100'],
		},
	},
});
