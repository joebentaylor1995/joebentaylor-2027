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
	// NOTE • The CI runner has 2 vCPUs and renders WebGL in software, and these
	// tests measure animation timing — two Chromium workers plus the server
	// starve each other, so CI runs one at a time. Timing-sensitive tests also
	// get two retries there: a test that fails all three attempts is a real
	// failure, one that passes on retry is reported as flaky. Consistent
	// failures live in tests/quarantine.ts.
	workers: process.env.CI ? 1 : undefined,
	retries: process.env.CI ? 2 : 0,
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
