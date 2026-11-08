// Imports
// ------------

import { readyProjects } from './helpers/ready-projects';
import { expect, test } from './helpers/test';

// Helpers
// ------------
// These bindings live in the ribbon iframe. Function predicates avoid string
// eval, which the production Content Security Policy deliberately blocks.
declare const ready: boolean;
declare const introduction: { active: boolean };
declare const gridView: { mix: number };
declare const projectTransition: { active: boolean; progress: number; settled: boolean };

// Tests
// ------------
// Protects the Projects to case study handoff in each ribbon mode: the ribbon expands into the real hero image
// before the URL changes, the header is never covered or replaced, text does not appear early, page scroll
// is blocked during the handoff, and Back returns to the ribbon.
for (const mode of ['featured', 'grid', 'mobile']) {
	test(`${mode} finishes expanding into the real hero before navigating`, async ({ page }) => {
		// Mark every case study ready so any tile can be opened
		await readyProjects(page);
		if (mode === 'mobile') await page.setViewportSize({ width: 440, height: 780 });
		const errors: string[] = [];
		page.on('pageerror', error => errors.push(error.message));
		await page.goto('/projects/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();

		// Wait for the ribbon, then for its intro to finish
		const frame = page.frameLocator('iframe[title="Interactive projects"]');
		await expect(frame.locator('#stage')).toBeVisible({ timeout: 20000 });
		const renderer = page.frames().find(item => item.url().includes('/projects-ribbon/'));
		if (!renderer) throw new Error('Missing ribbon');
		await renderer.waitForFunction(() => ready && !introduction.active);
		if (mode === 'grid') {
			await frame.getByRole('button', { name: /All projects/ }).click();
			await renderer.waitForFunction(() => gridView.mix === 1);
		}

		// Runs in the page while the handoff happens: every frame while the handoff cover exists it checks that the
		// header logo is hit-testable and fully visible, the header node is not replaced, hero text has not started,
		// and a wheel event is cancelled (so the page cannot scroll)
		const headerContinuity = page.evaluate(
			() =>
				new Promise<{
					seen: boolean;
					obscured: boolean;
					replaced: boolean;
					prematureText: boolean;
					scrollEscaped: boolean;
				}>(resolve => {
					const header = document.querySelector('header');
					const deadline = performance.now() + 20000;
					let seen = false,
						obscured = false,
						replaced = false,
						prematureText = false,
						scrollEscaped = false;
					const sample = () => {
						const cover = document.querySelector('[data-project-handoff]');
						if (cover) {
							seen = true;
							const wheel = new WheelEvent('wheel', { deltaY: 600, cancelable: true, bubbles: true });
							document.querySelector('#page')?.dispatchEvent(wheel);
							scrollEscaped ||= !wheel.defaultPrevented;
							prematureText ||= Boolean(
								document.querySelector(
									'[data-project-hero] [data-wave-state="playing"], [data-project-hero] [data-wave-state="complete"]'
								)
							);
							const logo = header?.querySelector('a')?.getBoundingClientRect();
							if (logo) {
								const hit = document.elementFromPoint(
									logo.x + logo.width / 2,
									logo.y + logo.height / 2
								);
								// Native view-transition snapshots temporarily return HTML for hit tests.
								if (hit !== document.documentElement) obscured ||= !header?.contains(hit);
							}
							if (header)
								obscured ||=
									getComputedStyle(header).opacity !== '1' ||
									getComputedStyle(header).visibility !== 'visible';
							replaced ||= document.querySelector('header') !== header;
						}
						if ((seen && !cover) || performance.now() > deadline)
							resolve({ seen, obscured, replaced, prematureText, scrollEscaped });
						else requestAnimationFrame(sample);
					};
					sample();
				})
		);

		// Start the transition; the URL must not change until it has finished expanding
		await frame.locator('#stage').press('Enter');
		await renderer.waitForFunction(() => projectTransition.active && projectTransition.progress < 1);
		expect(new URL(page.url()).pathname).toMatch(/^\/projects\/?$/);
		// Read the hero image URL and geometry the transition is aiming at
		const destination = (await renderer.evaluate(
			'({ hero: projectTransition.image.src, href: projectTransition.href, height: projectTransition.heroHeight, top: projectTransition.heroTop })'
		)) as { hero: string; href: string; height: number; top: number };
		await renderer.waitForFunction(() => projectTransition.settled);
		await page.waitForTimeout(40);
		expect(new URL(page.url()).pathname).toMatch(/^\/projects\/?$/);
		await expect(page).toHaveURL(new RegExp(`${destination.href}/?$`), { timeout: 20000 });

		// Real hero matches the transition target
		const hero = page.locator('[data-project-hero-media] img');
		await expect(hero).toBeVisible();
		expect(await hero.evaluate(el => (el as HTMLImageElement).currentSrc)).toBe(destination.hero);
		// Fluid rem sizing can round the two independently measured boxes by a
		// fraction of a CSS pixel. Still reject any visible (>= 0.5px) jump.
		expect(await hero.evaluate(el => el.getBoundingClientRect().height)).toBeCloseTo(destination.height, 0);
		expect(await hero.evaluate(el => el.getBoundingClientRect().top)).toBeCloseTo(destination.top, 0);
		await expect(hero).toHaveCSS('object-fit', 'cover');
		await expect(page.locator('[data-project-handoff]')).toHaveCount(0, { timeout: 5000 });

		// Header continuity results from the sampler above
		expect(await headerContinuity).toEqual({
			seen: true,
			obscured: false,
			replaced: false,
			prematureText: false,
			scrollEscaped: false,
		});

		// Title wave has played; paragraph waits for scrolling
		await expect(page.locator('[data-project-hero] h1 [data-reveal-variant="wave"]')).toHaveAttribute(
			'data-wave-state',
			'complete'
		);
		await expect(page.locator('[data-project-hero] p [data-reveal-variant="wave"]')).toHaveAttribute(
			'data-wave-state',
			'waiting'
		);

		// After the handoff the page scrolls normally and the paragraph reveals
		await page.mouse.move(200, 300);
		await page.mouse.wheel(0, 600);
		await expect
			.poll(() =>
				page.evaluate(() => Math.max(...Array.from(document.querySelectorAll('*'), el => el.scrollTop)))
			)
			.toBeGreaterThan(100);
		await expect(page.locator('[data-project-hero] p [data-reveal-variant="wave"]')).toHaveAttribute(
			'data-wave-state',
			'complete'
		);

		// Back returns to the interactive ribbon with no page errors
		await page.goBack();
		await expect(page).toHaveURL(/\/projects\/$/);
		await expect(frame.locator('#stage')).toBeVisible({ timeout: 15000 });
		expect(errors).toEqual([]);
	});
}
