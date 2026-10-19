import { mkdir, writeFile } from 'node:fs/promises';
import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import desktop from 'lighthouse/core/config/desktop-config.js';
import { chromium } from 'playwright';

export const profiles = {
	desktop: {
		...desktop.settings,
		screenEmulation: { mobile: false, width: 1440, height: 900, deviceScaleFactor: 1, disabled: false },
	},
	// Lighthouse's standard mid-range mobile/slow-4G profile, not an iPhone claim.
	mobile: { formFactor: 'mobile' },
};

export async function auditDeploy(baseUrl, paths = ['/'], runs = 3, devices = Object.keys(profiles)) {
	if (!Number.isInteger(runs) || runs < 1 || runs > 5) throw new Error('Expected 1–5 Lighthouse runs.');
	const reports = [];
	await mkdir('.lighthouseci/netlify', { recursive: true });
	for (const device of devices) {
		if (!profiles[device]) throw new Error(`Unknown Lighthouse profile: ${device}`);
		for (const path of paths) {
			const url = new URL(path, baseUrl);
			if (url.origin !== new URL(baseUrl).origin) throw new Error('Audit routes must stay on the deploy origin.');
			const results = [];
			for (let run = 0; run < runs; run++) {
				const chrome = await launch({
					chromePath: chromium.executablePath(),
					chromeFlags: ['--headless', '--no-sandbox', '--disable-dev-shm-usage'],
				});
				try {
					const result = await lighthouse(url.href, { port: chrome.port, logLevel: 'error', output: 'html' }, {
						extends: 'lighthouse:default',
						settings: { ...profiles[device], throttlingMethod: 'simulate', disableStorageReset: false },
					});
					if (!result || result.lhr.runtimeError) throw new Error(`${device} ${url.href}: ${result?.lhr.runtimeError?.message || 'No Lighthouse result'}`);
					if (result.lhr.categories.performance.score === null) throw new Error('No performance score');
					results.push(result);
					const name = `${device}-${path.replace(/[^a-z0-9]/gi, '_')}-${run + 1}`;
					await writeFile(`.lighthouseci/netlify/${name}.json`, JSON.stringify(result.lhr));
					console.log(`${device} ${path} run ${run + 1}/${runs}: ${result.lhr.lighthouseVersion}, performance ${result.lhr.categories.performance.score}`);
				} finally {
					await chrome.kill();
				}
			}
			results.sort((a, b) => a.lhr.categories.performance.score - b.lhr.categories.performance.score);
			const selected = results[Math.floor(results.length / 2)];
			reports.push({
				path: `${path} (${device})`,
				url: url.href,
				report: selected.report,
				summary: Object.fromEntries(Object.values(selected.lhr.categories)
					.filter(category => category.score !== null)
					.map(category => [category.id, Math.round(category.score * 100)])),
			});
		}
	}
	return reports;
}
