import { expect, test } from '@playwright/test';

for (const width of [440, 1440]) {
	test(`case study warms offscreen media at ${width}px`, async ({ page }) => {
		await page.setViewportSize({ width, height: 900 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 20000 });
		const tile = page.locator('[data-media-tile]').first();
		await tile.evaluate(el => {
			const scroll = document.querySelector('#page .lenis');
			const content = document.querySelector('[data-project-panel-content]');
			const hero = document.querySelector('[data-project-hero-layer]');
			if (!scroll || !content || !hero) throw new Error('Missing case study');
			const target = innerHeight + 350;
			const top =
				document.querySelector('[data-project-experience]')?.getAttribute('data-enhanced') === 'true'
					? Math.max(0, hero.clientHeight - innerHeight) +
						innerHeight * 0.9 +
						el.getBoundingClientRect().top -
						content.getBoundingClientRect().top -
						target
					: scroll.scrollTop + el.getBoundingClientRect().top - target;
			scroll.scrollTo({ top, behavior: 'instant' });
		});
		await expect(tile.locator('img')).toHaveAttribute('loading', 'eager');
		await expect(page.locator('[data-project-case-builder]')).toHaveAttribute('data-reveal-ready', 'true');
		await expect
			.poll(() =>
				tile
					.locator('img')
					.evaluate(el => (el as HTMLImageElement).complete && (el as HTMLImageElement).naturalWidth > 0)
			)
			.toBe(true);
		expect(await tile.evaluate(el => el.getBoundingClientRect().top)).toBeGreaterThan(900);
		// Far-away images remain native lazy images, not an eager page-wide download.
		await expect(page.locator('[data-media-tile]').last().locator('img')).toHaveAttribute('loading', 'lazy');
	});

	for (const route of ['/', '/projects/', '/projects/pocketchange/', '/terms-privacy/', '/cookies/']) {
		test(`frame sample ${route} at ${width}px`, async ({ page }, info) => {
			await page.setViewportSize({ width, height: 900 });
			const errors: string[] = [];
			page.on('pageerror', error => errors.push(error.message));
			await page.goto(route);
			await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 20000 });
			if (route === '/projects/')
				await expect(page.frameLocator('iframe[title="Interactive projects"]').locator('#stage')).toBeVisible();
			await page.waitForTimeout(1200);
			const sample = await page.evaluate(async () => {
				const probe = document.createElement('canvas').getContext('webgl');
				const debug = probe?.getExtension('WEBGL_debug_renderer_info');
				const renderer =
					probe && debug ? String(probe.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : 'unavailable';
				probe?.getExtension('WEBGL_lose_context')?.loseContext();
				const frames: number[] = [];
				const tasks: number[] = [];
				const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(e => e.duration)));
				observer.observe({ type: 'longtask' });
				const scroller = document.querySelector('#page .lenis');
				const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Interactive projects"]');
				const ribbon = frame?.contentDocument?.querySelector('canvas');
				let start = 0,
					previous = 0;
				await new Promise<void>(resolve => {
					const tick = (time: number) => {
						if (!start) start = time;
						if (previous) frames.push(time - previous);
						previous = time;
						if (ribbon)
							ribbon.dispatchEvent(
								new WheelEvent('wheel', { deltaY: 6, bubbles: true, cancelable: true })
							);
						else if (scroller) scroller.scrollTop += 8;
						if (time - start < 3000) requestAnimationFrame(tick);
						else resolve();
					};
					requestAnimationFrame(tick);
				});
				observer.disconnect();
				frames.sort((a, b) => a - b);
				return {
					renderer,
					frames: frames.length,
					medianMs: frames[Math.floor(frames.length / 2)],
					p95Ms: frames[Math.floor(frames.length * 0.95)],
					longTasks: tasks,
					overflow: document.documentElement.scrollWidth > innerWidth,
				};
			});
			await info.attach('frame-sample', {
				body: JSON.stringify({ route, width, ...sample }),
				contentType: 'application/json',
			});
			console.log(JSON.stringify({ route, width, ...sample }));
			expect(errors).toEqual([]);
			expect(sample.overflow).toBe(false);
			expect(sample.frames).toBeGreaterThan(10);
			await page.screenshot({ path: info.outputPath('page.png') });
		});
	}
}

test('case-study water stops rendering behind Profile', async ({ page }) => {
	await page.addInitScript(() => {
		const draw = WebGLRenderingContext.prototype.drawArrays;
		WebGLRenderingContext.prototype.drawArrays = function (mode, first, count) {
			const canvas = this.canvas as HTMLCanvasElement;
			if (canvas.hasAttribute('data-project-water'))
				canvas.dataset.draws = String(Number(canvas.dataset.draws || 0) + 1);
			return draw.call(this, mode, first, count);
		};
	});
	await page.goto('/projects/pocketchange/');
	const water = page.locator('[data-project-water]');
	await expect(water).toHaveAttribute('data-ready', 'true', { timeout: 20000 });
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await expect(page.locator('[data-profile-scene]')).toHaveAttribute('data-scene-paused', 'true');
	await page.waitForTimeout(300);
	const count = await water.getAttribute('data-draws');
	await page.mouse.move(300, 300);
	await page.mouse.move(600, 500, { steps: 10 });
	await page.waitForTimeout(300);
	await expect(water).toHaveAttribute('data-draws', count ?? '');
});
