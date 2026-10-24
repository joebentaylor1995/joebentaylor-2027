import { expect, type Page, test } from './helpers/test';

const compareFrames = async (page: Page, before: Buffer, after: Buffer) =>
	page.evaluate(
		async sources => {
			const frames = await Promise.all(
				sources.map(async source => {
					const bytes = Uint8Array.from(atob(source), value => value.charCodeAt(0));
					const image = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
					const context = new OffscreenCanvas(image.width, image.height).getContext('2d');
					if (!context) throw new Error('Unable to compare portrait frames');
					context.drawImage(image, 0, 0);
					const pixels = context.getImageData(0, 0, image.width, image.height).data;
					image.close();
					return pixels;
				})
			);
			let difference = 0;
			let changed = 0;
			for (let index = 0; index < frames[0].length; index++) {
				if (index % 4 === 3) continue;
				const delta = Math.abs(frames[0][index] - frames[1][index]);
				difference += delta;
				if (delta > 16) changed++;
			}
			const channels = (frames[0].length / 4) * 3;
			return { meanDifference: difference / channels, changedFraction: changed / channels };
		},
		[before.toString('base64'), after.toString('base64')]
	);

for (const viewport of [
	{ width: 1440, height: 900 },
	{ width: 1440, height: 1280 },
	{ width: 390, height: 844 },
]) {
	test(`projects to home keeps the portrait framing at ${viewport.width}×${viewport.height}`, async ({
		page,
	}, info) => {
		await page.setViewportSize(viewport);
		let releaseDepth = () => {};
		let depthGate = Promise.resolve();
		let depthRequested = false;
		await page.route('**/images/hero-depth/depth.webp', async route => {
			depthRequested = true;
			await depthGate;
			await route.continue();
		});
		await page.goto('/projects/');
		// Next's local toolbar overlaps the Projects link at narrow test widths.
		await page.addStyleTag({ content: 'nextjs-portal { display: none; }' });
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 20_000 });
		await expect(page.locator('iframe[title="Interactive projects"]')).toHaveAttribute('data-ribbon-ready', 'true');

		// Keep mobile samples above its gradient as well as the text/logo regions.
		const clip = {
			x: Math.round(viewport.width * 0.4),
			y: Math.round(viewport.height * 0.14),
			width: Math.round(viewport.width * 0.55),
			height: Math.round(viewport.height * (viewport.width === 390 ? 0.2 : 0.6)),
		};
		for (const visit of ['first', 'cached']) {
			depthGate = new Promise<void>(resolve => {
				releaseDepth = resolve;
			});
			depthRequested = false;
			await page.getByRole('link', { name: 'Go to home page' }).click();
			await expect(page.locator('html')).toHaveAttribute('data-navigation-wave', 'running');
			await expect(page).toHaveURL(/\/$/);
			await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete', {
				timeout: 20_000,
			});
			await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave');
			const portrait = page.getByTestId('hero-depth');
			// NOTE • A quick round trip (the phone crossfade) can serve the depth map from the browser's
			// in-memory image cache, which the route can't hold — then the GPU portrait is already up and
			// there is no native frame to compare against
			if (visit === 'first' || depthRequested) {
				await expect(portrait).toHaveAttribute('data-ready', 'false');
				await portrait.locator('img').evaluate((image: HTMLImageElement) => image.decode());
				const native = await page.screenshot({ clip, path: info.outputPath(`${visit}-native.png`) });
				releaseDepth();
				await expect(portrait).toHaveAttribute('data-ready', 'true');
				const gpu = await page.screenshot({ clip, path: info.outputPath(`${visit}-gpu.png`) });
				const difference = await compareFrames(page, native, gpu);
				console.log(`${viewport.width}×${viewport.height} ${visit} portrait handover`, difference);
				expect(difference.meanDifference).toBeLessThan(3);
				expect(difference.changedFraction).toBeLessThan(0.04);
			} else {
				releaseDepth();
				await expect(portrait).toHaveAttribute('data-ready', 'true');
			}
			await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
			await page.getByRole('link', { name: 'Projects', exact: true }).click();
			await expect(page.locator('html')).toHaveAttribute('data-navigation-wave', 'running');
			await expect(page).toHaveURL(/\/projects\/$/);
			await expect(page.locator('html')).not.toHaveAttribute('data-navigation-wave');
		}
	});
}
