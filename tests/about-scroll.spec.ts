import { expect, test } from '@playwright/test';

test('About uses 50% entry and exit parallax', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const about = page.locator('[data-about]');
	// Following sections are still placeholders; provide scroll room to exercise the exit.
	await about.evaluate(section => {
		const following = document.createElement('div');
		following.style.height = '100svh';
		section.after(following);
	});
	const moveTo = async (exit: boolean) =>
		about.evaluate((section, isExit) => {
			const root = section.closest('#profile-panel') as HTMLElement;
			const height = root.clientHeight;
			const top = root.scrollTop + section.getBoundingClientRect().top - root.getBoundingClientRect().top;
			root.scrollTop = isExit ? top + section.getBoundingClientRect().height - height / 2 : top - height / 2;
		}, exit);
	const translation = (index: number) =>
		about
			.locator('[data-about-frame] img')
			.nth(index)
			.evaluate(
				el => new DOMMatrix(getComputedStyle(el).transform).m42 / Number.parseFloat(getComputedStyle(el).height)
			);
	await moveTo(false);
	await expect.poll(() => translation(0)).toBeCloseTo(-0.25, 2);
	await moveTo(true);
	await expect.poll(() => translation(4)).toBeCloseTo(0.25, 2);
	await moveTo(false);
	await expect.poll(() => translation(4)).toBeCloseTo(0, 2);
});

test('About settings update the scrub, persist and reset', async ({ page }) => {
	await page.goto('/?modalSettings');
	const settings = page.getByRole('complementary', { name: 'Modal settings' });
	await settings.getByRole('button', { name: 'Show About', exact: true }).click();
	await settings.locator('#modal-aboutScrollDistance').fill('800');
	await settings.locator('#modal-aboutStartZoom').fill('200');
	await settings.locator('#modal-aboutFinalOpacity').fill('25');
	await settings.locator('#modal-aboutIntroParallax').fill('-30');
	await settings.locator('#modal-aboutExitParallax').fill('70');
	await settings.locator('#modal-aboutPreviousZoom').fill('40');
	const about = page.locator('[data-about]');
	await expect(about).toHaveCSS('--about-scroll-distance', '800svh');
	const scrollTo = async (screens: number) => {
		await about.evaluate((section, progress) => {
			const root = section.closest('#profile-panel') as HTMLElement;
			const frame = section.querySelector('[data-about-frame]');
			if (!frame) throw new Error('About frame missing');
			root.scrollTop +=
				section.getBoundingClientRect().top -
				root.getBoundingClientRect().top +
				frame.getBoundingClientRect().height * progress;
		}, screens);
	};
	await scrollTo(-0.5);
	await expect
		.poll(() =>
			about
				.locator('[data-about-frame] img')
				.first()
				.evaluate(
					el =>
						new DOMMatrix(getComputedStyle(el).transform).m42 /
						Number.parseFloat(getComputedStyle(el).height)
				)
		)
		.toBeCloseTo(-0.15, 2);
	await scrollTo(1);
	await expect
		.poll(() =>
			about
				.locator('[data-about-zoom]')
				.first()
				.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)
		)
		.toBeCloseTo(1.2, 2);
	const incoming = about.locator('[data-about-frame]').nth(1);
	await expect
		.poll(() => incoming.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a))
		.toBeCloseTo(0.5, 2);
	await expect
		.poll(() =>
			incoming.locator('[data-about-zoom]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)
		)
		.toBeCloseTo(1.5, 2);
	await scrollTo(9);
	await expect(about.locator('[data-about-frame]').last()).toHaveCSS('opacity', '0.25');
	await about.evaluate(section => {
		const following = document.createElement('div');
		following.style.height = '100svh';
		section.after(following);
	});
	await scrollTo(9.5);
	await expect
		.poll(() =>
			about
				.locator('[data-about-frame] img')
				.last()
				.evaluate(
					el =>
						new DOMMatrix(getComputedStyle(el).transform).m42 /
						Number.parseFloat(getComputedStyle(el).height)
				)
		)
		.toBeCloseTo(0.35, 2);
	await page.reload();
	await expect(settings.locator('#modal-aboutScrollDistance')).toHaveValue('800');
	await expect(settings.locator('#modal-aboutStartZoom')).toHaveValue('200');
	await expect(settings.locator('#modal-aboutFinalOpacity')).toHaveValue('25');
	await expect(settings.locator('#modal-aboutIntroParallax')).toHaveValue('-30');
	await expect(settings.locator('#modal-aboutExitParallax')).toHaveValue('70');
	await expect(settings.locator('#modal-aboutPreviousZoom')).toHaveValue('40');
	await settings.getByRole('button', { name: 'Reset defaults' }).click();
	await expect(settings.locator('#modal-aboutScrollDistance')).toHaveValue('400');
	await expect(settings.locator('#modal-aboutStartZoom')).toHaveValue('150');
	await expect(settings.locator('#modal-aboutFinalOpacity')).toHaveValue('40');
	await expect(settings.locator('#modal-aboutIntroParallax')).toHaveValue('-50');
	await expect(settings.locator('#modal-aboutExitParallax')).toHaveValue('50');
	await expect(settings.locator('#modal-aboutPreviousZoom')).toHaveValue('25');
});

test('About scrubs five images, reverses, and dims behind its text', async ({ page }) => {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const panel = page.locator('#profile-panel');
	const about = page.locator('[data-about]');
	const frames = about.locator('[data-about-frame]');
	await expect(frames.locator('img')).toHaveCount(5);
	const scrollTo = async (screens: number) => {
		await about.evaluate((section, progress) => {
			const root = section.closest('#profile-panel') as HTMLElement;
			const frame = section.querySelector('[data-about-frame]');
			if (!frame) throw new Error('About image frame missing');
			const height = frame.getBoundingClientRect().height;
			root.scrollTop +=
				section.getBoundingClientRect().top - root.getBoundingClientRect().top + height * progress;
		}, screens);
	};
	const scale = (index: number) => frames.nth(index).evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
	const innerScale = (index: number) =>
		frames
			.nth(index)
			.locator('[data-about-zoom]')
			.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a);
	await scrollTo(0.5);
	await expect.poll(() => scale(1)).toBeCloseTo(0.5, 1);
	await expect.poll(() => innerScale(1)).toBeCloseTo(1.25, 2);
	await expect.poll(() => innerScale(0)).toBeCloseTo(1.125, 2);
	await scrollTo(2.5);
	await expect.poll(() => scale(3)).toBeCloseTo(0.5, 1);
	await expect.poll(() => innerScale(3)).toBeCloseTo(1.25, 2);
	await expect.poll(() => innerScale(2)).toBeCloseTo(1.125, 2);
	await about.locator('[data-about-text]').evaluate(text => {
		const root = text.closest('#profile-panel') as HTMLElement;
		const bounds = text.getBoundingClientRect();
		root.scrollTop += bounds.top - root.getBoundingClientRect().top + bounds.height / 2 - root.clientHeight;
	});
	await expect.poll(() => frames.last().evaluate(el => Number(getComputedStyle(el).opacity))).toBeCloseTo(0.7, 2);
	await scrollTo(5);
	await expect(frames.last()).toHaveCSS('opacity', '0.4');
	await expect.poll(() => innerScale(4)).toBeCloseTo(1, 2);
	await expect(frames.nth(3)).toHaveCSS('visibility', 'hidden');
	for (const img of await frames.locator('img').all()) {
		await expect.poll(() => img.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
	}
	await scrollTo(1.5);
	await expect.poll(() => scale(2)).toBeCloseTo(0.5, 1);
	await expect.poll(() => innerScale(2)).toBeCloseTo(1.25, 2);
	await expect.poll(() => innerScale(1)).toBeCloseTo(1.125, 2);
	await expect(frames.nth(1)).toHaveCSS('visibility', 'visible');
	await page.getByRole('button', { name: 'Close profile', exact: true }).click();
	await expect(panel).toHaveAttribute('aria-hidden', 'true');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await scrollTo(0.5);
	await expect.poll(() => scale(1)).toBeCloseTo(0.5, 1);
});

test('About remains readable on mobile with reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const about = page.locator('[data-about]');
	await about.scrollIntoViewIfNeeded();
	await expect(about.locator('[data-about-frame]').first()).toHaveCSS('opacity', '0.4');
	await expect(about.locator('[data-about-frame]').last()).toHaveCSS('display', 'none');
	const bounds = await about.boundingBox();
	expect(bounds?.width).toBeLessThanOrEqual(390);
	expect(bounds?.height).toBeLessThan(1700);
});
