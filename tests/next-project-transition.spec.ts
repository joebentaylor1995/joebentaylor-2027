import { expect, test } from './helpers/test';

for (const mobile of [false, true]) {
	test(`Next Project uses the feathered wave under a fixed header (${mobile ? 'mobile' : 'desktop'})`, async ({
		page,
	}) => {
		if (mobile) await page.setViewportSize({ width: 440, height: 780 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
		for (let hop = 0; hop < 2; hop++) {
			await page
				.locator('#page .lenis')
				.first()
				.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
			const next = page.locator('a[data-next-project]:visible');
			await expect(next).toBeInViewport();
			const href = await next.getAttribute('href');
			await next.click();
			await page.waitForFunction(() => document.documentElement.dataset.navigationWave === 'running');
			const captured = await page.evaluate(() => {
				const animations = document.getAnimations();
				const wave = animations.find(
					animation =>
						animation.effect instanceof KeyframeEffect &&
						animation.effect.pseudoElement === '::view-transition-new(navigation-surface)'
				);
				wave?.pause();
				if (wave) wave.currentTime = 500;
				return {
					mask: getComputedStyle(document.documentElement, '::view-transition-new(navigation-surface)')
						.maskImage,
					filter: getComputedStyle(document.documentElement, '::view-transition-new(navigation-surface)')
						.filter,
					sliding: animations.some(
						animation =>
							animation instanceof CSSAnimation && animation.animationName.startsWith('vt-project-')
					),
				};
			});
			expect(captured.mask).toContain('radial-gradient');
			expect(captured.filter).toContain('navigation-wave-lens');
			expect(captured.sliding).toBe(false);
			await expect(page.locator('header')).toHaveCSS('view-transition-name', 'site-header');
			await expect(page.locator('[data-project-hero]:visible h1 [data-reveal-variant="wave"]')).toHaveAttribute(
				'data-wave-state',
				'waiting'
			);
			await page.evaluate(() => {
				for (const animation of document.getAnimations())
					if (
						animation.playState === 'paused' &&
						animation.effect instanceof KeyframeEffect &&
						animation.effect.pseudoElement?.startsWith('::view-transition')
					)
						animation.play();
			});
			await expect(page.locator('html')).not.toHaveAttribute('data-next-project-transition', 'true');
			await expect(page).toHaveURL(new RegExp(`${href?.replace(/\/$/, '')}/?$`));
			await expect.poll(() => page.evaluate(() => document.querySelector('#page .lenis')?.scrollTop)).toBe(0);
		}
	});
}
