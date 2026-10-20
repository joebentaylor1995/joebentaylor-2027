import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';

declare global {
	interface Window {
		youtubeTestPlayer: { state: number; plays: number; pauses: number };
	}
}

// Exercise the real lifecycle adapter with a deterministic player API, without
// depending on third-party ads, login prompts, or geographic playback restrictions.
const adapter = execFileSync(
	'bun',
	['build', resolve('src/utils/youtubePlayer.ts'), '--target=browser', '--format=esm'],
	{ encoding: 'utf8' }
);

test('profile pauses YouTube and only resumes playback that was previously running', async ({ page }) => {
	await page.route('**/__tests/youtube-player.js', route =>
		route.fulfill({ body: adapter, contentType: 'application/javascript' })
	);
	await page.route('https://www.youtube-nocookie.com/**', route =>
		route.fulfill({ body: '<html><body>Player fixture</body></html>', contentType: 'text/html' })
	);
	await page.goto('/projects/pocketchange/');
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 30_000 });
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await page.evaluate(async () => {
		window.youtubeTestPlayer = { state: 1, plays: 0, pauses: 0 };
		window.YT = {
			Player: class {
				constructor(...[, options]: ConstructorParameters<NonNullable<Window['YT']>['Player']>) {
					queueMicrotask(options.events.onReady);
				}
				getPlayerState() {
					return window.youtubeTestPlayer.state;
				}
				pauseVideo() {
					window.youtubeTestPlayer.state = 2;
					window.youtubeTestPlayer.pauses++;
				}
				playVideo() {
					window.youtubeTestPlayer.state = 1;
					window.youtubeTestPlayer.plays++;
				}
				destroy() {}
			},
		};
		const path = '/__tests/youtube-player.js';
		const { mountYouTubePlayer }: typeof import('../src/utils/youtubePlayer') = await import(path);
		const host = document.createElement('div');
		document.querySelector('[data-profile-scene]')?.append(host);
		mountYouTubePlayer(host, 'M7lc1UVf-VE', 'Test player');
	});
	const state = () => page.evaluate(() => window.youtubeTestPlayer);
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await expect.poll(state).toEqual({ state: 2, plays: 0, pauses: 1 });
	await page.getByRole('button', { name: 'Close profile', exact: true }).click();
	await expect.poll(state).toEqual({ state: 1, plays: 1, pauses: 1 });
	await page.evaluate(() => {
		window.youtubeTestPlayer.state = 2;
	});
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await page.getByRole('button', { name: 'Close profile', exact: true }).click();
	await expect(page.locator('[data-profile-scene]')).not.toHaveAttribute('data-scene-paused', 'true');
	expect(await state()).toEqual({ state: 2, plays: 1, pauses: 1 });
});
