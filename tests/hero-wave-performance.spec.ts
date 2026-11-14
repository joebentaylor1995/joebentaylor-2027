// Imports
// ------------
import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Measures the loader wave on an emulated phone with CPU throttled 4x and 6x. Set WAVE_TRACE=1 to log
// the page console and save a DevTools trace for investigating a failure.
// NOTE • The budgets below are absolute 60Hz frame times, and CPU throttling multiplies the host's own
// speed. CI's shared 2-core runners (two workers, software WebGL) can't hold 60Hz under 4-6x throttling,
// so the audit only runs locally, and only when the host itself can paint a bare WebGL page within the
// same budgets. A bare page over budget means the host (compositor or shared GPU) is the bottleneck, not the site.
// Frame-gap budgets: occasional missed vsync on the simulated slower CPU is allowed, sustained jank is not
const FRAME_BUDGET_MS = { median: 18, p95: 35, max: 70 };
// Median, 95th percentile and worst of a list of frame gaps
const frameStats = (gaps: number[]) => {
	const sorted = [...gaps].sort((first, second) => first - second);
	return {
		median: sorted[Math.floor(sorted.length / 2)],
		p95: sorted[Math.floor(sorted.length * 0.95)],
		max: Math.max(...sorted),
	};
};
for (const rate of [4, 6]) {
	test(`mobile loader fade frame budget at ${rate}x CPU slowdown`, async ({ browser }, testInfo) => {
		test.skip(!!process.env.CI, 'Absolute 60Hz frame budgets under 4-6x CPU throttling need a dedicated host');
		// A dedicated context is needed to emulate the phone (mobile, touch, 3x scale)
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			deviceScaleFactor: 3,
			isMobile: true,
			hasTouch: true,
		});
		const page = await context.newPage();
		// Calibrate: the frame gaps of a page that only clears a full-screen WebGL canvas, unthrottled.
		// The GPU is shared with every other browser on the host, so a busy GPU shows up here too.
		// The page needs the site's device-width viewport: a mobile page without one lays out 980px wide, which
		// made the calibration canvas ~6x the phone's pixels and skipped the test on every host.
		await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1">');
		const hostGaps = await page.evaluate(async () => {
			// Sized from the viewport before the canvas joins the page, and fixed so it never widens the layout
			// (a wider page makes a mobile viewport zoom out and the canvas grow with it)
			const canvas = document.createElement('canvas');
			canvas.width = innerWidth * devicePixelRatio;
			canvas.height = innerHeight * devicePixelRatio;
			Object.assign(canvas.style, { position: 'fixed', inset: '0', width: '100%', height: '100%' });
			document.body.appendChild(canvas);
			const gl = canvas.getContext('webgl');
			const gaps: number[] = [];
			let previous = await new Promise<number>(requestAnimationFrame);
			for (let i = 0; i < 60; i++) {
				gl?.clearColor(i % 2, 0, 0, 1);
				gl?.clear(gl.COLOR_BUFFER_BIT);
				const time = await new Promise<number>(requestAnimationFrame);
				gaps.push(time - previous);
				previous = time;
			}
			canvas.remove();
			return gaps;
		});
		const host = frameStats(hostGaps);
		if (
			host.median >= FRAME_BUDGET_MS.median ||
			host.p95 >= FRAME_BUDGET_MS.p95 ||
			host.max >= FRAME_BUDGET_MS.max
		) {
			await context.close();
			test.skip(true, `A bare WebGL page already misses the frame budget on this host: ${JSON.stringify(host)}`);
		}
		if (process.env.WAVE_TRACE) page.on('console', message => console.log(message.text()));
		const session = await context.newCDPSession(page);
		await session.send('Emulation.setCPUThrottlingRate', { rate });
		if (process.env.WAVE_TRACE)
			await session.send('Tracing.start', { categories: 'devtools.timeline,v8', transferMode: 'ReturnAsStream' });
		// Audit collected from the reveal event to the loader settled event: frame gaps from requestAnimationFrame
		// and any main-thread task of 50ms or more (the long task threshold) within that window
		await page.addInitScript(() => {
			const audit = {
				running: false,
				done: false,
				readyAtStart: false,
				startedAt: 0,
				endedAt: 0,
				gaps: [] as number[],
				longTasks: [] as number[],
				tasks: [] as { start: number; duration: number }[],
			};
			Object.assign(window, { heroWaveAudit: audit });
			window.addEventListener('site-loader:settled', () => {
				if (audit.running) {
					audit.running = false;
					audit.endedAt = performance.now();
					audit.done = true;
				}
			});
			new PerformanceObserver(list => {
				audit.tasks.push(
					...list.getEntries().map(entry => ({ start: entry.startTime, duration: entry.duration }))
				);
				if (audit.startedAt)
					audit.longTasks.push(
						...list
							.getEntries()
							.filter(
								entry =>
									entry.startTime + entry.duration > audit.startedAt &&
									(!audit.endedAt || entry.startTime < audit.endedAt)
							)
							.map(
								entry =>
									Math.min(entry.startTime + entry.duration, audit.endedAt || Infinity) -
									Math.max(entry.startTime, audit.startedAt)
							)
							.filter(duration => duration >= 50)
					);
			}).observe({ type: 'longtask' });
			window.addEventListener(
				'site-loader:reveal',
				() => {
					audit.readyAtStart = document.querySelector('[data-liquid-ready="true"]') !== null;
					audit.startedAt = performance.now();
					performance.mark('wave-start');
					audit.running = true;
					let previous = 0;
					const sample = (time: number) => {
						if (previous) audit.gaps.push(time - previous);
						previous = time;
						if (audit.running) requestAnimationFrame(sample);
					};
					requestAnimationFrame(sample);
				},
				{ once: true }
			);
		});
		try {
			// Wait for the loader to settle, then read the audit
			await page.goto(testInfo.project.use.baseURL || 'http://localhost:3000/');
			await page.waitForFunction(
				() => (window as unknown as { heroWaveAudit: { done: boolean } }).heroWaveAudit.done,
				undefined,
				{ timeout: 30000 }
			);
			const audit = await page.evaluate(
				() =>
					(
						window as unknown as {
							heroWaveAudit: { readyAtStart: boolean; gaps: number[]; longTasks: number[] };
						}
					).heroWaveAudit
			);

			// Frame gap statistics
			if (process.env.WAVE_TRACE) console.log(JSON.stringify(audit));
			const result = {
				rate,
				readyAtStart: audit.readyAtStart,
				frames: audit.gaps.length,
				...frameStats(audit.gaps),
				host,
				longTasks: audit.longTasks,
			};
			await testInfo.attach('wave-frame-budget', {
				body: JSON.stringify(result, null, 2),
				contentType: 'application/json',
			});
			console.log(JSON.stringify(result));

			// Optional: stop tracing and attach the trace
			if (process.env.WAVE_TRACE) {
				const completed = new Promise<{ stream?: string }>(resolve =>
					session.once('Tracing.tracingComplete', resolve)
				);
				await session.send('Tracing.end');
				const { stream } = await completed;
				if (!stream) throw new Error('Missing performance trace stream');
				let trace = '';
				for (;;) {
					const chunk = await session.send('IO.read', { handle: stream });
					trace += chunk.data;
					if (chunk.eof) break;
				}
				await session.send('IO.close', { handle: stream });
				await testInfo.attach('wave-trace', { body: trace, contentType: 'application/json' });
				await writeFile(testInfo.outputPath('wave-trace.json'), trace);
				console.log('Measured URL:', page.url());
			}
			expect(result.readyAtStart).toBe(true);
			expect(result.frames).toBeGreaterThan(4);
			expect(result.median).toBeLessThan(FRAME_BUDGET_MS.median);
			expect(result.p95).toBeLessThan(FRAME_BUDGET_MS.p95);
			expect(result.max).toBeLessThan(FRAME_BUDGET_MS.max);
			expect(result.longTasks).toEqual([]);
		} finally {
			await context.close();
		}
	});
}
