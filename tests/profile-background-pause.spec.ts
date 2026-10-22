import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { expect, type Frame, type Page, test } from './helpers/test';

const videoPlayback = execFileSync(
	'bun',
	['build', resolve('src/utils/observeVideoPlayback.ts'), '--target=browser', '--format=esm'],
	{ encoding: 'utf8' }
);

declare global {
	interface Window {
		sceneProbe: { draws: WeakMap<HTMLCanvasElement, number>; videos: Set<HTMLMediaElement> };
		holdWarmFrame: boolean;
	}
}

declare const gridView: { mix: number; pan: { x: number; y: number } };
declare const position: number;
declare const ready: boolean;
const pageErrors = new WeakMap<Page, string[]>();

test.beforeEach(async ({ page }) => {
	const errors: string[] = [];
	pageErrors.set(page, errors);
	page.on('pageerror', error => errors.push(error.message));
	await page.addInitScript(() => {
		const draws = new WeakMap<HTMLCanvasElement, number>();
		const videos = new Set<HTMLMediaElement>();
		window.sceneProbe = { draws, videos };
		for (const context of [WebGLRenderingContext, WebGL2RenderingContext]) {
			for (const method of ['drawArrays', 'drawElements'] as const) {
				const original = context.prototype[method];
				context.prototype[method] = function (...args: number[]) {
					const canvas = this.canvas as HTMLCanvasElement;
					draws.set(canvas, (draws.get(canvas) ?? 0) + 1);
					Reflect.apply(original, this, args);
				};
			}
		}
		const play = HTMLMediaElement.prototype.play;
		HTMLMediaElement.prototype.play = function () {
			videos.add(this);
			return play.call(this);
		};
	});
});

test.afterEach(({ page }, testInfo) => {
	// NOTE • A quarantined test is skipped before beforeEach records its errors
	if (testInfo.expectedStatus === 'skipped') return;
	expect(pageErrors.get(page)).toEqual([]);
});

const openPage = async (page: Page, path: string) => {
	await page.goto(path);
	// The development toolbar overlaps the mobile navigation; it is absent in production.
	await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 30_000 });
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
};

const sample = (context: Page | Frame, selector: string) =>
	context.evaluate(selector => {
		const { draws, videos } = window.sceneProbe;
		const root = document.querySelector(selector);
		return {
			ribbonPosition: typeof position === 'number' ? position : null,
			grid: typeof gridView === 'undefined' ? null : { pan: { ...gridView.pan }, mix: gridView.mix },
			draws: [...(root?.querySelectorAll('canvas') ?? [])].reduce(
				(sum, canvas) => sum + (draws.get(canvas) ?? 0),
				0
			),
			playing: [...videos].filter(video => !video.paused && !video.ended).length,
			times: [...videos].map(video => video.currentTime),
			movingAnimations: (root?.getAnimations({ subtree: true }) ?? []).filter(
				animation =>
					animation.effect instanceof KeyframeEffect &&
					animation.effect.target !== root &&
					animation.playState === 'running'
			).length,
		};
	}, selector);

const checkPause = async (
	page: Page,
	context: Page | Frame,
	selector: string,
	media: boolean,
	profileContent = false
) => {
	const before = await sample(context, selector);
	await expect.poll(async () => (await sample(context, selector)).draws).toBeGreaterThan(before.draws);
	if (media) await expect.poll(async () => (await sample(context, selector)).playing).toBeGreaterThan(0);
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await expect(page.locator('[data-profile-scene]')).toHaveAttribute('data-scene-paused', 'true');
	await page.waitForTimeout(100);
	const paused = await sample(context, selector);
	await page.waitForTimeout(700);
	const covered = await sample(context, selector);
	console.log({ selector, drawsWhileCovered: covered.draws - paused.draws, playingWhileCovered: covered.playing });
	expect(covered.draws).toBe(paused.draws);
	expect(covered.ribbonPosition).toBe(paused.ribbonPosition);
	expect(covered.grid).toEqual(paused.grid);
	expect(covered.playing).toBe(0);
	expect(covered.movingAnimations).toBe(0);
	covered.times.forEach((time, index) => {
		expect(time).toBeCloseTo(paused.times[index], 2);
	});
	if (profileContent) {
		const recognition = page.locator('[data-recognition]');
		await recognition.evaluate(element => {
			const panel = element.closest<HTMLElement>('#profile-panel');
			if (panel) panel.scrollTop += element.getBoundingClientRect().top - panel.getBoundingClientRect().top;
		});
		await expect(recognition).toHaveAttribute('data-state', 'ready');
		const profileDraws = (await sample(page, '[data-recognition]')).draws;
		await expect.poll(async () => (await sample(page, '[data-recognition]')).draws).toBeGreaterThan(profileDraws);
		expect((await sample(context, selector)).draws).toBe(covered.draws);
		await page.screenshot({ path: 'test-results/profile-grid-paused.png' });
	}
	await page.getByRole('button', { name: 'Close profile', exact: true }).click();
	// Keep the underlying scene still throughout the closing animation too.
	await page.waitForTimeout(350);
	expect((await sample(context, selector)).draws).toBe(covered.draws);
	await expect(page.locator('[data-profile-scene]')).not.toHaveAttribute('data-scene-paused', 'true');
	await expect.poll(async () => (await sample(context, selector)).draws).toBeGreaterThan(covered.draws);
	if (media) await expect.poll(async () => (await sample(context, selector)).playing).toBeGreaterThan(0);
};

for (const [label, width, grid] of [
	['featured desktop', 1440, false],
	['featured tablet', 768, false],
	['grid desktop', 1440, true],
	['grid tablet', 768, true],
	['ribbon mobile', 390, false],
] as const) {
	test(`profile pauses and resumes ${label}, including all video decoders`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		const projects = Array.from({ length: 6 }, (_, index) => ({
			id: `project-${index}`,
			name: `Project ${index}`,
			type: 'video',
			poster: `/projects-ribbon/assets/featured/02.jpg?tile=${index}`,
			video: '/projects-ribbon/assets/featured/01.mp4',
			isReady: false,
		}));
		await page.route('**/api/projects-ribbon/', route =>
			route.fulfill({ json: { featured: projects.slice(0, 4), all: projects } })
		);
		await openPage(page, '/projects/');
		await expect(page.locator('iframe[title="Interactive projects"]')).toHaveAttribute('data-ribbon-ready', 'true');
		const renderer = page.frames().find(frame => frame.url().includes('/projects-ribbon/'));
		if (!renderer) throw Error('Missing ribbon renderer');
		if (grid) {
			await renderer.getByRole('button', { name: /All projects/ }).click();
			await renderer.waitForFunction(() => gridView.mix === 1);
		}
		await checkPause(page, renderer, 'body', true, label === 'grid desktop');
		if (grid) expect(await renderer.evaluate(() => gridView.mix)).toBe(1);
		await checkPause(page, renderer, 'body', true);
	});
}

for (const width of [390, 1440]) {
	test(`profile pauses native case-study video at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.route('**/__tests/video-playback.js', route =>
			route.fulfill({ body: videoPlayback, contentType: 'application/javascript' })
		);
		await openPage(page, '/projects/pocketchange/');
		// CMS currently has no native gallery video. Exercise the component's real
		// playback lifecycle with local media without mutating published content.
		await page.evaluate(async () => {
			const path = '/__tests/video-playback.js';
			const { observeVideoPlayback }: typeof import('../src/utils/observeVideoPlayback') = await import(path);
			const video = document.createElement('video');
			video.dataset.testVideo = '';
			video.src = '/projects-ribbon/assets/featured/01.mp4';
			video.muted = true;
			video.loop = true;
			video.playsInline = true;
			video.style.cssText = 'position:fixed;top:200px;left:20px;width:240px;height:160px;z-index:10';
			document.querySelector('[data-profile-scene]')?.append(video);
			observeVideoPlayback(video);
		});
		const video = page.locator('[data-test-video]');
		await expect(video).toBeInViewport();
		await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(false);
		await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
		await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(true);
		const time = await video.evaluate(element => (element as HTMLVideoElement).currentTime);
		await page.waitForTimeout(700);
		expect(await video.evaluate(element => (element as HTMLVideoElement).currentTime)).toBeCloseTo(time, 2);
		await page.getByRole('button', { name: 'Close profile', exact: true }).click();
		await expect(page.locator('[data-profile-scene]')).not.toHaveAttribute('data-scene-paused', 'true');
		await expect.poll(() => video.evaluate(element => (element as HTMLVideoElement).paused)).toBe(false);
	});
}

for (const [label, path, selector] of [
	['home portrait', '/', '[data-profile-scene]'],
	['mobile home', '/', '[data-profile-scene]'],
	['case-study hero', '/projects/pocketchange/', '[data-profile-scene]'],
	['case-study footer', '/projects/pocketchange/', '[data-project-outro]'],
] as const) {
	test(`profile pauses and resumes the ${label}`, async ({ page }) => {
		if (label === 'mobile home') await page.setViewportSize({ width: 390, height: 844 });
		await openPage(page, path);
		if (label === 'mobile home')
			await expect(page.locator('[data-logo-track]')).toHaveCSS('animation-play-state', 'running');
		if (label === 'case-study footer') {
			await page
				.locator('#page .lenis')
				.first()
				.evaluate(element => element.scrollTo({ top: element.scrollHeight, behavior: 'instant' }));
			await expect(page.locator('[data-footer-matrix]')).toHaveAttribute('data-ready', 'true');
		}
		await checkPause(page, page, selector, false);
		if (label === 'mobile home')
			await expect(page.locator('[data-logo-track]')).toHaveCSS('animation-play-state', 'running');
	});
}

test('closing Profile finishes a background ribbon warm-up interrupted before its first frame', async ({ page }) => {
	await page.addInitScript(() => {
		if (window === window.parent || !location.pathname.includes('/projects-ribbon/')) return;
		window.holdWarmFrame = true;
		const request = window.requestAnimationFrame.bind(window);
		window.requestAnimationFrame = callback =>
			callback.name === 'render' && window.holdWarmFrame ? request(() => {}) : request(callback);
	});
	await openPage(page, '/');
	await expect.poll(() => page.frames().some(frame => frame.url().includes('/projects-ribbon/'))).toBe(true);
	const renderer = page.frames().find(frame => frame.url().includes('/projects-ribbon/'));
	if (!renderer) throw Error('Missing ribbon renderer');
	await renderer.waitForFunction(() => ready);
	const frame = page.locator('iframe[title="Interactive projects"]');
	await expect(frame).not.toHaveAttribute('data-ribbon-ready', 'true');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await expect(page.locator('[data-profile-scene]')).toHaveAttribute('data-scene-paused', 'true');
	await renderer.evaluate(() => {
		window.holdWarmFrame = false;
	});
	await page.getByRole('button', { name: 'Close profile', exact: true }).click();
	await expect(frame).toHaveAttribute('data-ribbon-ready', 'true');
	await expect(page.locator('section[aria-label="Projects"]')).toHaveAttribute('data-state', 'cached');
});
