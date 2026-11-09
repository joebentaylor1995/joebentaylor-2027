// Playwright Configuration
// ------------
// NOTE • One smoke test keeps `bun run test` honest — it boots the real
// production build and fails on anything broken enough to show at first
// paint. Grow suites in tests/ as the project grows.
import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env.PLAYWRIGHT_PORT || 3000);
const baseURL = `http://localhost:${port}`;

export default defineConfig({
	testDir: './tests',
	timeout: 60_000,
	// NOTE • One retry on CI: the runner draws WebGL in software on shared cores, so a frame can
	// occasionally stall long enough to fail a timing check. A retried pass is still reported as
	// flaky in the run summary, so a test that needs it stays visible.
	retries: process.env.CI ? 1 : 0,
	use: {
		baseURL,
		// NOTE • Sandboxed environments (agent containers, locked-down CI) often
		// ship a system Chromium instead of allowing downloads — point
		// PLAYWRIGHT_CHROMIUM_PATH at it to skip `playwright install` entirely
		...(process.env.PLAYWRIGHT_CHROMIUM_PATH && {
			launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH },
		}),
	},
	webServer: {
		// CI builds in an earlier step; locally, build fresh so the test
		// always exercises what would actually ship
		command: process.env.CI ? `bun run start --port ${port}` : `bun run build && bun run start --port ${port}`,
		url: baseURL,
		reuseExistingServer: !process.env.CI,
		timeout: 180_000,
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } }],
});
