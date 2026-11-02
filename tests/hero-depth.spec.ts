// Imports
// ------------
import { expect, test } from './helpers/test';

// Tests
// ------------
// Protects the hero render loop: once the intro has settled, the shader attribute lookup is not
// repeated every frame (a lookup per frame would be wasted work).
test('settled animation does not query shader attributes on every frame', async ({ page }) => {
	// Count every getAttribLocation call on <html> so the page can be sampled from outside
	await page.addInitScript(() => {
		const original = WebGLRenderingContext.prototype.getAttribLocation;
		WebGLRenderingContext.prototype.getAttribLocation = function (...args) {
			document.documentElement.dataset.attributeQueries = String(
				Number(document.documentElement.dataset.attributeQueries || 0) + 1
			);
			return original.apply(this, args);
		};
	});
	await page.goto('/');
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);

	// The colour portrait is fetched exactly once
	const colourRequests = await page.evaluate(() =>
		performance
			.getEntriesByType('resource')
			.map(entry => entry.name)
			.filter(url => url.includes('portrait-colour'))
	);
	expect(colourRequests).toHaveLength(1);
	expect(colourRequests[0]).toContain('/portrait-colour.webp');
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete');

	// Compare the counter 500ms apart: some calls happened during setup, but none while idle
	await page.waitForTimeout(300);
	const count = await page.locator('html').getAttribute('data-attribute-queries');
	expect(Number(count)).toBeGreaterThan(0);
	await page.waitForTimeout(500);
	expect(await page.locator('html').getAttribute('data-attribute-queries')).toBe(count);
});

// Protects the desktop portrait sizing: the drawn portrait stays 1.12x the viewport width at any
// desktop width instead of freezing at a maximum.
test('portrait continues scaling with the viewport width', async ({ page }) => {
	await page.setViewportSize({ width: 1440, height: 900 });
	await page.goto('/?heroSettings');
	await expect(page.locator('[data-hero-content]')).toHaveAttribute('data-entrance', 'complete', { timeout: 10000 });
	const canvas = page.getByTestId('hero-depth').locator('canvas');
	// Reads the zoom uniform from the live WebGL program and combines it with the canvas size.
	// 1.4455 mirrors the portrait image width/height ratio for the cover fit.
	const portraitWidth = () =>
		canvas.evaluate(element => {
			const gl = (element as HTMLCanvasElement).getContext('webgl');
			if (!gl) throw new Error('Missing WebGL');
			const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
			const zoom = gl.getUniformLocation(program, 'zoom');
			if (!zoom) throw new Error('Missing zoom');
			const bounds = element.getBoundingClientRect();
			return Math.max(bounds.width, bounds.height * 1.4455) * (gl.getUniform(program, zoom) as number);
		});
	for (const width of [1440, 1920, 2560]) {
		await page.setViewportSize({ width, height: 900 });
		await expect.poll(portraitWidth).toBeCloseTo(width * 1.12, 1);
	}
	await page.setViewportSize({ width: 1283, height: 800 });
	await expect.poll(portraitWidth).toBeCloseTo(1283 * 1.12, 1);
});

// Protects the intro against early input: hovering before the entrance ends neither sets the cursor
// state nor stalls the zoom, and the cursor takes over once the intro is done.
test('early hover does not interrupt intro and a slow ripple keeps updating without input', async ({ page }) => {
	await page.goto('/?heroSettings');
	const content = page.locator('[data-hero-content]');
	await expect(content).toHaveAttribute('data-entrance', 'complete', { timeout: 10000 });
	await page.getByLabel('Ripple speed value', { exact: true }).fill('0.25');
	const canvas = page.getByTestId('hero-depth').locator('canvas');
	// Reads the portrait zoom and cursor uniforms, plus any GL error
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

	// Move the pointer in during the intro
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

// Protects the intro handoff: pointer movement while the text is still entering already drives both
// the depth motion and the water ripple.
test('depth and water cursor respond together after the ripple while text is still entering', async ({ page }) => {
	// Flags <html> the first time the water shader's "amount" uniform is written
	await page.addInitScript(() => {
		const amounts = new WeakSet<WebGLUniformLocation>();
		const getLocation = WebGLRenderingContext.prototype.getUniformLocation;
		const setVector = WebGLRenderingContext.prototype.uniform3fv;
		WebGLRenderingContext.prototype.getUniformLocation = function (program, name) {
			const location = getLocation.call(this, program, name);
			if (location && name === 'amount') amounts.add(location);
			return location;
		};
		WebGLRenderingContext.prototype.uniform3fv = function (location, value) {
			if (location && amounts.has(location)) document.documentElement.dataset.waterStroke = 'true';
			return setVector.call(this, location, value);
		};
	});
	await page.goto('/?heroSettings');
	const content = page.locator('[data-hero-content]');
	await expect(content).toHaveAttribute('data-entrance', 'complete');
	await page.getByRole('button', { name: 'Replay introduction', exact: true }).click();
	await expect(page.locator('[data-scene-cover]')).toHaveAttribute('data-complete', 'true');
	await expect(content).toHaveAttribute('data-entrance', 'running');

	// Move the pointer while the text is still animating in
	await page.mouse.move(100, 300);
	await page.mouse.move(350, 350, { steps: 5 });
	await expect(page.locator('html')).toHaveAttribute('data-water-stroke', 'true', { timeout: 750 });
	await expect
		.poll(
			() =>
				page
					.getByTestId('hero-depth')
					.locator('canvas')
					.evaluate(element => {
						const gl = (element as HTMLCanvasElement).getContext('webgl');
						if (!gl) throw new Error('Missing WebGL');
						const program = gl.getParameter(gl.CURRENT_PROGRAM) as WebGLProgram;
						const location = gl.getUniformLocation(program, 'motion');
						if (!location) throw new Error('Missing motion uniform');
						const motion = gl.getUniform(program, location) as Float32Array;
						return Math.abs(motion[0]);
					}),
			{ timeout: 750 }
		)
		.toBeGreaterThan(0.01);
	await expect(content).toHaveAttribute('data-entrance', 'running');
});

// Protects the intro settings panel: values appear in the exported JSON and the replay applies the
// new timing, more than once.
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

	// Export reflects every edited control
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

	// Replay twice: at 1.2s the first word is still hidden, and the cover and text finish afterwards
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

// Protects the final state of the entrance: everything is visible, the text stops redrawing, and
// switching to reduced motion keeps it revealed.
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

	// The text texture must not keep updating once settled
	const frame = await content.getAttribute('data-text-frame');
	await page.waitForTimeout(200);
	expect(await content.getAttribute('data-text-frame')).toBe(frame);
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await expect(content).toHaveAttribute('data-entrance', 'complete');
	await expect(content.locator('[data-reveal-word]').first()).toHaveCSS('opacity', '1');
});

// Protects the WebGL text layer tracking real HTML: changing the paragraph text, colour and size in the
// DOM shows up as green pixels in the canvas at both desktop widths; mobile falls back to HTML.
test('desktop hero text follows HTML content and CSS, with a mobile fallback', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
	const content = page.locator('[data-hero-content]');
	await expect(content).toHaveCSS('opacity', '0');
	for (const width of [1283, 1440]) {
		await page.setViewportSize({ width, height: 800 });
		// Restyle the paragraph in place
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
						// Hooks the next on-screen draw call, reads back the pixels under the paragraph and counts green ones.
						// Offscreen passes (a framebuffer is bound) are skipped.
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

	// Below desktop width the WebGL layer steps aside and the HTML text is shown
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(content).toHaveCSS('opacity', '1');
	await expect(content.locator('p')).toBeVisible();
});

// Protects the canvas matching CSS-driven decoration: a border and a responsive gap set on the marquee
// are reproduced in the canvas pixels.
test('WebGL decoration follows CSS border and responsive spacing changes', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
	for (const width of [1283, 1440]) {
		await page.setViewportSize({ width, height: 800 });
		await page.locator('[data-logo-marquee]').evaluate(
			// Different gap per width, plus a 4px green top border
			(element, gap) => {
				(element as HTMLElement).style.setProperty('--gap-l', `${gap}px`);
				(element as HTMLElement).style.borderTop = '4px solid rgb(0, 128, 0)';
			},
			width === 1283 ? 48 : 64
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
						const heading = marquee.querySelector('h2');
						if (!heading) throw new Error('Marquee heading unavailable');
						const labelPaddingX = heading.getBoundingClientRect().right - bounds.left - 4;
						// Read one pixel on the border and one at the label padding on the next draw: [border RGBA, label RGBA]
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
								const labelPixel = new Uint8Array(4);
								gl.readPixels(
									Math.floor((labelPaddingX * canvas.width) / bounds.width),
									Math.floor(((bounds.height - y) * canvas.height) / bounds.height),
									1,
									1,
									gl.RGBA,
									gl.UNSIGNED_BYTE,
									labelPixel
								);
								gl.drawArrays = original;
								resolve([...pixel, ...labelPixel]);
							};
						});
					})
			)
			.toEqual([0, 128, 0, 255, 240, 237, 237, 255]);
	}

	// On mobile the WebGL layer is switched off
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(0);
	await expect(page.getByRole('heading', { name: 'Clients include', exact: true })).toBeVisible();
});

// Protects the liquid controls panel: it opens and closes, edits export to the settings JSON, persist
// until reset, and Escape returns focus to the toggle.
test('liquid controls toggle, update and reset without restarting the hero', async ({ page }) => {
	// Short timeout so a missing control fails quickly instead of waiting out the test timeout
	page.setDefaultTimeout(5_000);
	await page.goto('/?heroSettings');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'true');
	const toggle = page.getByRole('button', { name: 'Liquid controls', exact: true });
	const panel = page.getByRole('region', { name: 'Liquid glass controls' });
	await expect(toggle).toHaveAttribute('aria-expanded', 'false');
	await expect(panel).toHaveCount(0);

	// Open and expand the panel
	await toggle.click();
	await expect(panel).toBeVisible();
	await page.getByRole('button', { name: 'Expand all', exact: true }).click();
	const layer = panel.getByRole('checkbox', { name: 'Show in front of portrait' });
	await expect(layer).toBeChecked();
	await expect(panel.getByRole('slider', { name: 'Highlight strength' })).toHaveValue('0.78');

	// Change a few controls
	await layer.uncheck();
	await expect(layer).not.toBeChecked();
	const size = panel.getByRole('slider', { name: 'Brush size', exact: true });
	await expect(size).toHaveValue('45');
	await size.fill('80');
	await page.getByRole('slider', { name: 'Default logo speed', exact: true }).fill('2');
	await page.getByRole('slider', { name: 'Blur velocity threshold' }).fill('0.65');
	await page.getByRole('slider', { name: 'Colour switch velocity threshold' }).fill('0.9');

	// Changes appear in the exported settings
	const exported = JSON.parse(await page.getByRole('textbox', { name: 'All hero settings JSON' }).inputValue());
	expect(exported.liquid).toMatchObject({ size: 80, inFront: false, marqueeSpeed: 2, marqueeBlurThreshold: 0.65 });
	expect(exported.portrait.colourThreshold).toBe(0.9);

	// Closing and reopening keeps the edits
	await page.getByRole('button', { name: 'Hide liquid controls' }).click();
	await expect(panel).toHaveCount(0);
	await toggle.click();
	await expect(panel).toBeVisible();
	await page.getByRole('button', { name: 'Expand all', exact: true }).click();
	await expect(size).toHaveValue('80');
	await expect(layer).not.toBeChecked();

	// Reset restores defaults without restarting the hero
	await panel.getByRole('button', { name: 'Reset saved defaults' }).click();
	await expect(size).toHaveValue('45');
	await expect(layer).toBeChecked();
	await expect(page.locator('[data-liquid-ready="true"]')).toHaveCount(1);
	await size.press('Escape');
	await expect(toggle).toBeFocused();
	await expect(panel).toHaveCount(0);

	// No toggle on mobile
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(toggle).toBeHidden();
});

// Protects the liquid effect lifecycle: pointer movement causes no GL errors, and shrinking to mobile
// swaps it for the static portrait and HTML marquee, then desktop brings it back.
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
	// No GL errors after the pointer sweep
	expect(
		await page
			.getByTestId('hero-depth')
			.locator('canvas')
			.evaluate(element => (element as HTMLCanvasElement).getContext('webgl')?.getError())
	).toBe(0);

	// Mobile: liquid off, marquee and static portrait on
	await page.setViewportSize({ width: 390, height: 844 });
	await expect(hero).not.toHaveAttribute('data-liquid-ready', 'true');
	await expect(marquee).toHaveCSS('opacity', '1');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'false');
	await expect(page.getByTestId('hero-depth').locator('img')).toBeVisible();

	// Back to desktop
	await page.setViewportSize({ width: 1283, height: 720 });
	await expect(hero).toHaveAttribute('data-liquid-ready', 'true', { timeout: 30_000 });
});

// Protects the fallback when the GPU lacks float textures: the original portrait and marquee stay.
test('unsupported liquid textures preserve the original portrait and marquee', async ({ page }) => {
	// Pretend OES_texture_float is not available
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

// Protects production output: no settings panels, no prototype copy, and no settings code in any
// downloaded script; wheel input over the hero still scrolls the page.
test('hero renders without prototype chrome or a settings download', async ({ page }) => {
	const errors: string[] = [];
	// Collect every script body to check the settings code never ships
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
	// Settings code must not be present in any script the page downloaded
	expect(
		(await Promise.all(downloadedScripts)).some(
			source => source.includes('Only loaded with ?heroSettings.') || source.includes('Show in front of portrait')
		)
	).toBe(false);

	// A wheel event over the hero must not be cancelled
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

// Protects ?heroSettings: it loads the scroll zoom controls (and none of the removed particle or
// wireframe ones), and the zoom value reaches the shader.
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
	// Read scroll velocity and the zoom setting (second scrollFX entry) from the live program
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

// Protects reduced motion: the portrait stays a static image and the depth texture is never fetched.
test('reduced motion keeps a static portrait and skips WebGL textures', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const requests: string[] = [];
	page.on('request', request => requests.push(request.url()));
	await page.goto('/');
	await expect(page.getByTestId('hero-depth')).toHaveAttribute('data-ready', 'false');
	await expect(page.getByTestId('hero-depth').locator('img')).toBeVisible();
	expect(requests.some(url => url.includes('/hero-depth/depth.webp'))).toBe(false);
});
