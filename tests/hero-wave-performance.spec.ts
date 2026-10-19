import { writeFile } from 'node:fs/promises';
import { expect, test } from '@playwright/test';

for (const rate of [4, 6]) {
	test(`mobile loader fade frame budget at ${rate}x CPU slowdown`, async ({ browser }, testInfo) => {
		const context = await browser.newContext({
			viewport: { width: 390, height: 844 },
			deviceScaleFactor: 3,
			isMobile: true,
			hasTouch: true,
		});
		const page = await context.newPage();
		if (process.env.WAVE_TRACE) page.on('console', message => console.log(message.text()));
		const session = await context.newCDPSession(page);
		await session.send('Emulation.setCPUThrottlingRate', { rate });
		if (process.env.WAVE_TRACE)
			await session.send('Tracing.start', { categories: 'devtools.timeline,v8', transferMode: 'ReturnAsStream' });
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
			const sorted = [...audit.gaps].sort((a, b) => a - b);
			if (process.env.WAVE_TRACE) console.log(JSON.stringify(audit));
			const result = {
				rate,
				readyAtStart: audit.readyAtStart,
				frames: sorted.length,
				median: sorted[Math.floor(sorted.length / 2)],
				p95: sorted[Math.floor(sorted.length * 0.95)],
				max: Math.max(...sorted),
				longTasks: audit.longTasks,
			};
			await testInfo.attach('wave-frame-budget', {
				body: JSON.stringify(result, null, 2),
				contentType: 'application/json',
			});
			console.log(JSON.stringify(result));
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
			// Allow occasional missed vsync on the simulated slower CPU, not sustained jank.
			expect(result.readyAtStart).toBe(true);
			expect(result.frames).toBeGreaterThan(4);
			expect(result.median).toBeLessThan(18);
			expect(result.p95).toBeLessThan(35);
			expect(result.max).toBeLessThan(70);
			expect(result.longTasks).toEqual([]);
		} finally {
			await context.close();
		}
	});
}
