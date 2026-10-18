const { execFileSync } = require('node:child_process');
const { dirname, join } = require('node:path');

// Run after deployment: Next's SSR, image CDN and server functions must be live.
module.exports = {
	async onSuccess({ inputs, utils }) {
		const url = process.env.DEPLOY_URL;
		if (!url) return utils.build.failPlugin('DEPLOY_URL is required for live Lighthouse audits.');
		try {
			// Match the Chromium version pinned by Playwright rather than the build
			// image's incidental system browser. Installation reuses its browser cache.
			const cli = join(dirname(require.resolve('playwright/package.json')), 'cli.js');
			execFileSync(process.execPath, [cli, 'install', 'chromium'], {
				stdio: 'inherit',
			});
			const { auditDeploy } = await import('./runner.mjs');
			const reports = await auditDeploy(url, inputs.paths, inputs.runs);
			utils.status.show({
				title: 'Lighthouse 13 — live desktop and mobile',
				summary: reports.map(report => `${report.path}: ${JSON.stringify(report.summary)}`).join('\n'),
				text: 'Three cold-browser runs per route/device. Median performance run; simulated network/CPU. Not a 120fps or real-device test.',
				extraData: reports,
			});
		} catch (error) {
			utils.build.failPlugin('Live Lighthouse audit failed; no score should be inferred.', { error });
		}
	},
};
