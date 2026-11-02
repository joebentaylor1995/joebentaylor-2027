// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the "Next Project" link at the foot of a case study, on desktop and mobile: it uses the same
// feathered wave (or the phone crossfade) as any page change, with the header held still, the project
// slide animation off, and the new title waiting to reveal. Hops twice to cover a second navigation.
for (const mobile of [false, true]) {
	test(`Next Project ${mobile ? 'crossfades' : 'uses the feathered wave'} under a fixed header (${mobile ? 'mobile' : 'desktop'})`, async ({
		page,
	}) => {
		if (mobile) await page.setViewportSize({ width: 440, height: 780 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });

		for (let hop = 0; hop < 2; hop++) {
			// Scroll to the bottom so the Next Project link is in view, then follow it
			await page
				.locator('#page .lenis')
				.first()
				.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
			const next = page.locator('a[data-next-project]:visible');
			await expect(next).toBeInViewport();
			const href = await next.getAttribute('href');
			await next.click();
			await page.waitForFunction(() => document.documentElement.dataset.navigationWave === 'running');

			// Freeze the wave at 500ms and read what the transition is doing at that point
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
					filter: getComputedStyle(
						document.documentElement,
						'::view-transition-image-pair(navigation-surface)'
					).filter,
					fade: animations.some(
						animation =>
							animation instanceof CSSAnimation &&
							animation.animationName === 'vt-fade' &&
							(animation.effect as KeyframeEffect).pseudoElement ===
								'::view-transition-new(navigation-surface)'
					),
					sliding: animations.some(
						animation =>
							animation instanceof CSSAnimation && animation.animationName.startsWith('vt-project-')
					),
				};
			});

			// Phones swap the wave for a plain crossfade (see NavigationWave)
			if (mobile) {
				expect(captured.fade).toBe(true);
				expect(captured.mask).toBe('none');
			} else {
				expect(captured.mask).toContain('radial-gradient');
				expect(captured.filter).toContain('navigation-wave-lens');
			}
			expect(captured.sliding).toBe(false);

			// Header stays put and the incoming title waits for the wave
			await expect(page.locator('header')).toHaveCSS('view-transition-name', 'site-header');
			await expect(page.locator('[data-project-hero]:visible h1 [data-reveal-variant="wave"]')).toHaveAttribute(
				'data-wave-state',
				'waiting'
			);

			// Resume the frozen animations and check the hop lands on the next project, scrolled to the top
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
