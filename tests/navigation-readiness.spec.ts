import { expect, test } from './helpers/test';

declare const IdleMotion: new (
	wake: () => void
) => {
	mode: string;
	lastActivity: number;
	speed: number;
	timer: number;
	update(time: number, dt: number, mode: string, blocked: boolean): { delta: number };
};
declare const position: number;

test('home and projects respond promptly and keep the wave moving on repeat visits', async ({ page }) => {
	await page.goto('/projects/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 20_000 });
	await expect(page.locator('iframe[title="Interactive projects"]')).toHaveAttribute('data-ribbon-ready', 'true');
	const measurements: { delay: number; longestFrame: number }[] = [];
	for (const name of ['Go to home page', 'Projects', 'Go to home page', 'Projects']) {
		await page.evaluate(() => {
			const root = document.documentElement;
			delete root.dataset.testWaveFrames;
			document.addEventListener(
				'click',
				() => {
					const clicked = performance.now();
					let started = 0,
						previous = 0,
						longestFrame = 0;
					const sample = (now: number) => {
						if (root.dataset.navigationWave === 'running') {
							started ||= now;
							if (previous) longestFrame = Math.max(longestFrame, now - previous);
							previous = now;
						} else if (started) {
							root.dataset.testWaveFrames = JSON.stringify({ delay: started - clicked, longestFrame });
							return;
						}
						if (now - clicked < 5000) requestAnimationFrame(sample);
					};
					requestAnimationFrame(sample);
				},
				{ capture: true, once: true }
			);
		});
		await page.getByRole('link', { name, exact: true }).click();
		await expect(page.locator('html')).toHaveAttribute('data-test-wave-frames', /longestFrame/);
		const measurement = JSON.parse((await page.locator('html').getAttribute('data-test-wave-frames')) || '{}');
		expect(measurement.delay).toBeGreaterThan(0);
		expect(measurement.delay).toBeLessThan(300);
		expect(measurement.longestFrame).toBeGreaterThan(0);
		expect(measurement.longestFrame).toBeLessThan(100);
		measurements.push(measurement);
		await expect(page.locator('html')).not.toHaveAttribute('data-navigation-pending');
	}
	console.log('Repeated navigation timing:', measurements);
});

test('navigation starts while the ribbon loads, then fades in its first rendered frame', async ({ page }) => {
	await page.addInitScript(() => {
		// Delay the actual poster loads without disabling the browser's HTTP
		// cache (request interception makes Next's dev server bypass its caches).
		if (window !== window.parent && location.pathname === '/projects-ribbon/index.html') {
			const descriptor = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
			if (!descriptor?.set) throw new Error('Image source setter unavailable');
			const setter = descriptor.set;
			const pending: (() => void)[] = [];
			let released = false;
			Object.defineProperty(HTMLImageElement.prototype, 'src', {
				...descriptor,
				set(value: string) {
					if (released) setter.call(this, value);
					else pending.push(() => setter.call(this, value));
				},
			});
			window.addEventListener(
				'test:release-posters',
				() => {
					released = true;
					for (const load of pending) load();
				},
				{ once: true }
			);
		}
		document.addEventListener(
			'click',
			event => {
				if (event.target instanceof Element && event.target.closest('a[href="/projects/"]')) {
					document.documentElement.dataset.testClickAt = String(performance.now());
				}
			},
			true
		);
		new MutationObserver(() => {
			const root = document.documentElement;
			if (root.dataset.navigationWave === 'running' && root.dataset.testClickAt) {
				root.dataset.testWaveDelay = String(performance.now() - Number(root.dataset.testClickAt));
				delete root.dataset.testClickAt;
			}
		}).observe(document, { subtree: true, attributes: true, attributeFilter: ['data-navigation-wave'] });
	});
	await page.goto('/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-site-loader]')).toHaveAttribute('data-complete', 'true', { timeout: 20_000 });
	const frame = page.locator('iframe[title="Interactive projects"]');
	await page.getByRole('link', { name: 'Projects', exact: true }).click();
	await expect(page.locator('html')).toHaveAttribute('data-navigation-wave', 'running');
	const delay = Number(await page.locator('html').getAttribute('data-test-wave-delay'));
	console.log('Click to wave with ribbon still loading:', Math.round(delay), 'ms');
	expect(delay).toBeGreaterThan(0);
	expect(delay).toBeLessThan(300);
	await expect(frame).toHaveCSS('opacity', '0');
	await expect(frame).not.toHaveAttribute('data-ready', 'true');
	await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave', 'running');
	const renderer = page.frames().find(candidate => candidate.url().includes('/projects-ribbon/index.html'));
	if (!renderer) throw new Error('Missing ribbon');
	await renderer.evaluate(() => window.dispatchEvent(new Event('test:release-posters')));
	await expect(frame).toHaveAttribute('data-ribbon-ready', 'true', { timeout: 15_000 });
	await page.waitForFunction(() => {
		const element = document.querySelector('iframe[title="Interactive projects"]');
		const opacity = element ? Number(getComputedStyle(element).opacity) : 0;
		return opacity > 0 && opacity < 1;
	});
	await expect(frame).toHaveCSS('opacity', '1');
	await page.screenshot({ path: 'test-results/projects-late-fade.png' });
});

test('idle ribbon drift stays slow after a long idle and stops off-page', async ({ page }) => {
	await page.goto('/projects/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('iframe[title="Interactive projects"]')).toHaveAttribute('data-ribbon-ready', 'true', {
		timeout: 20_000,
	});
	const frame = page.frames().find(candidate => candidate.url().includes('/projects-ribbon/index.html'));
	if (!frame) throw new Error('Missing ribbon');
	const speeds = await frame.evaluate(() => {
		// The runtime class is intentionally global in the standalone document.
		const motion = new IdleMotion(() => {});
		clearTimeout(motion.timer);
		motion.mode = 'featured';
		motion.lastActivity = 0;
		return [4000, 30_000, 120_000].map(time => motion.update(time, 1 / 60, 'featured', false).delta * 60);
	});
	expect(speeds).toEqual([0.08, 0.08, 0.08]);
	await page.getByRole('link', { name: 'Go to home page' }).click();
	await expect(page).toHaveURL(/\/$/);
	await expect(page.locator('html')).toHaveAttribute('data-navigation-wave', 'running');
	await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave', 'running');
	await expect(page.locator('section[aria-label="Projects"]')).toHaveAttribute('data-state', 'cached');
	const positions = await frame.evaluate(async () => {
		const before = position;
		await new Promise(resolve => setTimeout(resolve, 250));
		return [before, position];
	});
	expect(positions[1]).toBe(positions[0]);
});
