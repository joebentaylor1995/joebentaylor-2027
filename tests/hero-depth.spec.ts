import { expect, test } from '@playwright/test';

test('early hover does not interrupt intro and a slow ripple keeps updating without input', async ({ page }) => {
	await page.goto('/?heroSettings');
	const content = page.locator('[data-hero-content]');
	await expect(content).toHaveAttribute('data-entrance', 'complete', { timeout: 10000 });
	await page.getByLabel('Ripple speed value', { exact: true }).fill('0.25');
	const canvas = page.getByTestId('hero-depth').locator('canvas');
	const read = () =>
		canvas.evaluate(element => {
			const gl = (element as HTMLCanvasElement).getContext('webgl');
			if (!gl) throw new Error('Missing WebGL');
			const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
			const zoom = gl.getUniformLocation(program, 'zoom');
			const cursor = gl.getUniformLocation(program, 'cursorOn');
			if (!zoom || !cursor) throw new Error('Missing portrait uniforms');
			return {
				zoom: gl.getUniform(program, zoom) as number,
				cursor: gl.getUniform(program, cursor) as number,
				error: gl.getError(),
			};
		});
	await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
	await page.mouse.move(100, 330);
	await page.mouse.move(450, 420, { steps: 10 });
	await page.waitForTimeout(1800);
	const early = await read();
	expect(early.cursor).toBe(0);
	expect(early.error).toBe(0);
	await page.waitForTimeout(500);
	expect((await read()).zoom).toBeLessThan(early.zoom - 0.01);
	await expect(content).toHaveAttribute('data-entrance', 'complete', { timeout: 10000 });
	await page.mouse.move(150, 350);
	await expect.poll(async () => (await read()).cursor).toBe(1);
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
});

test('intro controls export and replay repeatedly with changed timing', async ({ page }) => {
	await page.goto('/?heroSettings');
	const content = page.locator('[data-hero-content]');
	await expect(content).toHaveAttribute('data-entrance', 'complete', { timeout: 10000 });
	await page.getByLabel('Ripple strength value', { exact: true }).fill('1.5');
	await page.getByLabel('Ripple width value', { exact: true }).fill('1.4');
	await page.getByLabel('Ripple speed value', { exact: true }).fill('0.5');
	await page.getByLabel('Easing preset').selectOption('sine.inOut');
	await page.getByLabel('Portrait intro scale value', { exact: true }).fill('1.8');
	await page.getByLabel('Portrait finish by (%) value', { exact: true }).fill('40');
	await page.getByLabel('Portrait easing', { exact: true }).selectOption('power3.out');
	await page.getByText('Heading & paragraph timing', { exact: true }).click();
	await page.getByLabel('Heading start value', { exact: true }).fill('0.7');
	await page.getByLabel('Paragraph start value', { exact: true }).fill('2.5');
	await page.getByLabel('Word stagger value', { exact: true }).fill('0.04');
	await page.getByLabel('Copyright fade duration value', { exact: true }).fill('0.6');
	await page.getByLabel('Copyright line growth duration value', { exact: true }).fill('0.8');
	await page.getByLabel('Copyright digit stagger value', { exact: true }).fill('0.1');
	const exported = JSON.parse(await page.getByLabel('All hero settings JSON').inputValue());
	expect(exported.intro).toMatchObject({
		headingStart: 0.7,
		paragraphStart: 2.5,
		wordStagger: 0.04,
		copyrightFade: 0.6,
		copyrightLineDuration: 0.8,
		copyrightDigitStagger: 0.1,
		strength: 1.5,
		width: 1.4,
		speed: 0.5,
		ease: 'sine.inOut',
		portraitScale: 1.8,
		portraitFinish: 40,
		portraitEase: 'power3.out',
	});
	for (let attempt = 0; attempt < 2; attempt++) {
		await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
		await expect(content).toHaveAttribute('data-entrance', 'running');
		await page.waitForTimeout(1200);
		await expect(content.locator('[data-reveal-word]').first()).toHaveCSS('opacity', '0');
		await expect(page.locator('[data-scene-cover]')).not.toHaveAttribute('data-complete');
		await expect(content).toHaveAttribute('data-entrance', 'complete', { timeout: 10000 });
		await expect(content.locator('[data-reveal-word]').first()).toHaveCSS('opacity', '1');
		await expect(page.locator('[data-scene-cover]')).toHaveAttribute('data-complete', 'true');
	}
});

test('hero entrance settles and reduced motion reveals content immediately', async ({ page }) => {
	await page.goto('/');
	const content = page.locator('[data-hero-content]');
	await expect(content).toHaveAttribute('data-entrance', 'complete', { timeout: 10000 });
	await expect(content.locator('[data-reveal-word]').first()).toHaveCSS('opacity', '1');
	await expect(content.locator('svg')).toHaveCSS('opacity', '1');
	await expect(page.locator('[data-copyright-icon]')).toHaveCSS('opacity', '1');
	await expect(page.locator('[data-copyright-digit]')).toHaveCount(8);
	for (const digit of await page.locator('[data-copyright-digit]').all()) {
		await expect(digit).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
	}
	const frame = await content.getAttribute('data-text-frame');
	await page.waitForTimeout(200);
	expect(await content.getAttribute('data-text-frame')).toBe(frame);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(content).toHaveAttribute('data-entrance', 'complete');
	await expect(content.locator('[data-reveal-word]').first()).toHaveCSS('opacity', '1');
});

test('desktop hero text follows HTML content and CSS, with a mobile fallback', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
	const content = page.locator('[data-hero-content]');
	await expect(content).toHaveCSS('opacity', '0');
	for (const width of [1280, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await content.locator('p').evaluate(element => {
			element.textContent = 'Responsive text follows the HTML layout.';
			(element as HTMLElement).style.color = 'rgb(0, 180, 0)';
			(element as HTMLElement).style.fontSize = '28px';
		});
		await expect
			.poll(() =>
				page
					.getByTestId('hero-depth')
					.locator('canvas')
					.evaluate(element => {
						const canvas = element as HTMLCanvasElement;
						const gl = canvas.getContext('webgl');
						if (!gl) throw new Error('WebGL unavailable');
						const rect = document.querySelector('[data-hero-content] p')?.getBoundingClientRect();
						if (!rect) throw new Error('Text unavailable');
						const bounds = canvas.getBoundingClientRect();
						const scale = canvas.width / bounds.width;
						return new Promise<number>(resolve => {
							const original = gl.drawArrays.bind(gl);
							gl.drawArrays = (mode, first, count) => {
								original(mode, first, count);
								if (gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) return;
								const w = Math.floor(rect.width * scale),
									h = Math.floor(rect.height * scale);
								const pixels = new Uint8Array(w * h * 4);
								gl.readPixels(
									Math.floor((rect.left - bounds.left) * scale),
									Math.floor((bounds.bottom - rect.bottom) * scale),
									w,
									h,
									gl.RGBA,
									gl.UNSIGNED_BYTE,
									pixels
								);
								gl.drawArrays = original;
								let green = 0;
								for (let i = 0; i < pixels.length; i += 4)
									if (pixels[i + 1] > pixels[i] + 60 && pixels[i + 1] > pixels[i + 2] + 60) green++;
								resolve(green);
							};
						});
					})
			)
			.toBeGreaterThan(100);
	}
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(content).toHaveCSS('opacity', '1');
	await expect(content.locator('p')).toBeVisible();
});

test('WebGL decoration follows CSS border and responsive spacing changes', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
	for (const width of [1280, 1440]) {
		await page.setViewportSize({ width, height: 900 });
		await page.locator('[data-logo-marquee]').evaluate(
			(element, gap) => {
				(element as HTMLElement).style.setProperty('--gap-l', `${gap}px`);
				(element as HTMLElement).style.borderTop = '4px solid rgb(0, 128, 0)';
			},
			width === 1280 ? 48 : 64
		);
		await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
		await expect
			.poll(async () =>
				page
					.getByTestId('hero-depth')
					.locator('canvas')
					.evaluate(element => {
						const canvas = element as HTMLCanvasElement;
						const gl = canvas.getContext('webgl');
						if (!gl) throw new Error('WebGL unavailable');
						const marquee = document.querySelector('[data-logo-marquee]');
						if (!marquee) throw new Error('Marquee unavailable');
						const bounds = canvas.getBoundingClientRect();
						const y = marquee.getBoundingClientRect().top + 2 - bounds.top;
						return new Promise<number[]>(resolve => {
							const original = gl.drawArrays.bind(gl);
							gl.drawArrays = (mode, first, count) => {
								original(mode, first, count);
								if (gl.getParameter(gl.FRAMEBUFFER_BINDING) !== null) return;
								const pixel = new Uint8Array(4);
								gl.readPixels(
									Math.floor((5 * canvas.width) / bounds.width),
									Math.floor(((bounds.height - y) * canvas.height) / bounds.height),
									1,
									1,
									gl.RGBA,
									gl.UNSIGNED_BYTE,
									pixel
								);
								gl.drawArrays = original;
								resolve(Array.from(pixel));
							};
						});
					})
			)
			.toEqual([0, 128, 0, 255]);
	}
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Trusted by', exact: true })).toBeVisible();
});

test('liquid controls toggle, update and reset without restarting the hero', async ({ page }) => {
	page.setDefaultTimeout(5_000);
	await page.goto('/?heroSettings');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true');
	const toggle = page.getByRole('button', { name: 'Liquid controls', exact: true });
	const panel = page.getByRole('region', { name: 'Liquid glass controls' });
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(panel).toHaveCount(0);
	await toggle.click();
	await expect(panel).toBeVisible();
	await page.getByRole('button', { name: 'Expand all', exact: true }).click();
	const layer = panel.getByRole('checkbox', { name: 'Show in front of portrait' });
	await expect(layer).toBeChecked();
	await expect(panel.getByRole('slider', { name: 'Highlight strength' })).toHaveValue('0.78');
	await layer.uncheck();
	await expect(layer).not.toBeChecked();
	const size = panel.getByRole('slider', { name: 'Brush size', exact: true });
	await expect(size).toHaveValue('45');
	await size.fill('80');
	await page.getByRole('slider', { name: 'Default logo speed', exact: true }).fill('2');
	await page.getByRole('slider', { name: 'Blur velocity threshold' }).fill('0.65');
	await page.getByRole('slider', { name: 'Colour switch velocity threshold' }).fill('0.9');
	const exported = JSON.parse(await page.getByRole('textbox', { name: 'All hero settings JSON' }).inputValue());
	expect(exported.liquid).toMatchObject({ size: 80, inFront: false, marqueeSpeed: 2, marqueeBlurThreshold: 0.65 });
	expect(exported.portrait.colourThreshold).toBe(0.9);
	await page.getByRole('button', { name: 'Hide liquid controls' }).click();
	await expect(panel).toHaveCount(0);
	await toggle.click();
	await expect(panel).toBeVisible();
	await page.getByRole('button', { name: 'Expand all', exact: true }).click();
	await expect(size).toHaveValue('80');
	await expect(layer).not.toBeChecked();
	await panel.getByRole('button', { name: 'Reset saved defaults' }).click();
	await expect(size).toHaveValue('45');
	await expect(layer).toBeChecked();
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
	await size.press('Escape');
	await expect(toggle).toBeFocused();
	await expect(panel).toHaveCount(0);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(toggle).toBeHidden();
});

test('desktop liquid survives cursor input and returns to the HTML marquee on mobile', async ({ page }) => {
	await page.goto('/');
	const hero = page
		.locator('section')
		.filter({ has: page.getByTestId('hero-depth') })
		.first();
	const marquee = page.locator('[data-logo-marquee]');
	await expect(hero).toHaveAttribute('data-liquid-ready', 'true', { timeout: 30_000 });
	await expect(marquee).toHaveCSS('opacity', '0');
	await page.mouse.move(900, 350);
	await page.mouse.move(350, 550, { steps: 20 });
	expect(
		await page
			.getByTestId('hero-depth')
			.locator('canvas')
			.evaluate(element => (element as HTMLCanvasElement).getContext('webgl')?.getError())
	).toBe(0);
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(hero).not.toHaveAttribute('data-liquid-ready', 'true');
	await expect(marquee).toHaveCSS('opacity', '1');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true');
	await page.setViewportSize({ width: 1280, height: 720 });
	await expect(hero).toHaveAttribute('data-liquid-ready', 'true', { timeout: 30_000 });
});

test('unsupported liquid textures preserve the original portrait and marquee', async ({ page }) => {
	await page.addInitScript(() => {
		const original = WebGLRenderingContext.prototype.getExtension;
		WebGLRenderingContext.prototype.getExtension = new Proxy(original, {
			apply(target, context, args) {
				return args[0] === 'OES_texture_float' ? null : Reflect.apply(target, context, args);
			},
		});
	});
	await page.goto('/');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
	await expect(page.locator('[data-logo-marquee]')).toHaveCSS('opacity', '1');
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(0);
});

test('hero renders without prototype chrome or a settings download', async ({ page }) => {
	const errors: string[] = [];
	const downloadedScripts: Promise<string>[] = [];
	page.on('pageerror', error => errors.push(error.message));
	page.on('response', response => {
		if (response.request().resourceType() === 'script') downloadedScripts.push(response.text().catch(() => ''));
	});
	await page.goto('/');
	const effect = page.getByTestId('hero-depth');
	await expect(effect).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
	await expect(page.getByRole('heading', { name: 'Digital Narrative Architect' })).toBeVisible();
	await expect(page.locator('[data-hero-settings]')).toHaveCount(0);
	await expect(page.locator('[data-liquid-controls]')).toHaveCount(0);
	await expect(page.getByRole('button', { name: 'Liquid controls', exact: true })).toHaveCount(0);
	await expect(page.getByText('Depth study', { exact: true })).toHaveCount(0);
	expect(
		(await Promise.all(downloadedScripts)).some(
			source => source.includes('Only loaded with ?heroSettings.') || source.includes('Show in front of portrait')
		)
	).toBe(false);
	const canvas = effect.locator('canvas');
	await canvas.evaluate(element => {
		// Measure the hero listener before the site's Lenis scroll handler.
		element.closest('section')?.addEventListener('wheel', event => event.stopPropagation(), { once: true });
		const event = new WheelEvent('wheel', { deltaY: 600, bubbles: true, cancelable: true });
		element.dispatchEvent(event);
		if (event.defaultPrevented) throw new Error('Hero blocked page scrolling');
	});
	await page.waitForTimeout(300);
	expect(await canvas.evaluate(element => (element as HTMLCanvasElement).getContext('webgl')?.getError())).toBe(0);
	expect(errors).toEqual([]);
});

test('explicit query loads scroll zoom controls without particles', async ({ page }, testInfo) => {
	await page.goto('/?heroSettings');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true', { timeout: 30_000 });
	const panel = page.getByRole('region', { name: 'Hero effect settings' });
	await expect(panel).toBeVisible();
	await page.getByRole('button', { name: 'Expand all', exact: true }).click();
	await expect(panel.getByRole('slider', { name: 'Scroll zoom strength', exact: true })).toHaveValue('1.1');
	await expect(panel.getByRole('checkbox', { name: 'Scroll depth zoom', exact: true })).toBeChecked();
	await expect(panel.getByText(/particles|click pulse/i)).toHaveCount(0);
	await expect(panel.getByText(/wireframe/i)).toHaveCount(0);
	await panel.getByRole('slider', { name: 'Scroll zoom strength', exact: true }).fill('2');
	await panel.getByRole('button', { name: 'Preview downward scroll' }).click();
	await page.waitForTimeout(350);
	const zoomState = await page
		.getByTestId('hero-depth')
		.locator('canvas')
		.evaluate(element => {
			const gl = (element as HTMLCanvasElement).getContext('webgl');
			if (!gl) throw new Error('WebGL unavailable');
			const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
			const velocity = gl.getUniformLocation(program, 'scrollVelocity');
			const zoom = gl.getUniformLocation(program, 'scrollFX[1]');
			if (!velocity || !zoom) throw new Error('Scroll zoom uniforms missing');
			return {
				velocity: gl.getUniform(program, velocity) as number,
				zoom: gl.getUniform(program, zoom) as number,
			};
		});
	expect(zoomState.velocity).toBeGreaterThan(0.01);
	expect(zoomState.zoom).toBe(2);
	await page.screenshot({ path: testInfo.outputPath('scroll-zoom.png') });
	expect(
		await page
			.getByTestId('hero-depth')
			.locator('canvas')
			.evaluate(element => (element as HTMLCanvasElement).getContext('webgl')?.getError())
	).toBe(0);
	await panel.getByRole('button', { name: 'Reset saved defaults' }).click();
	await expect(panel.getByRole('slider', { name: 'Scroll zoom strength', exact: true })).toHaveValue('1.1');
});

test('reduced motion keeps a static portrait and skips WebGL textures', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const requests: string[] = [];
	page.on('request', request => requests.push(request.url()));
	await page.goto('/');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'false');
	await expect(page.getByTestId('hero-depth').locator('img')).toBeVisible();
	expect(requests.some(url => url.includes('/hero-depth/depth.webp'))).toBe(false);
});
