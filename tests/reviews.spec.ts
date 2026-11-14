// Imports
// ------------
import { expect, type Page, test } from '@playwright/test';

// Helpers
// ------------
// Opens Profile, scrolls to Reviews and waits for the carousel to enhance. React plays a chain of view
// transitions while the page hydrates, and a click that lands while one covers the page reaches the document
// root instead of the button, so the click is repeated until the trigger reports the panel as expanded.
async function openReviews(page: Page) {
	await page.goto('/');
	const trigger = page.getByRole('button', { name: 'Open Profile', exact: true });
	await expect(async () => {
		if ((await trigger.getAttribute('aria-expanded')) !== 'true') await trigger.click();
		await expect(trigger).toHaveAttribute('aria-expanded', 'true', { timeout: 1000 });
	}).toPass();
	const section = page.locator('[data-reviews]');
	await section.scrollIntoViewIfNeeded();
	await expect(section).toHaveAttribute('data-enhanced', 'true');
	return section;
}

// Tests
// ------------
// Protects the Reviews carousel: ten slides, Next and Previous wrap in both directions, the section height and
// author position never jump between slides, and every portrait and company logo loads.
test('Reviews animate, wrap in both directions, and keep all portraits and logos available', async ({ page }) => {
	// NOTE • Thirteen animated slide changes (about a second each, and Next is ignored while one runs) on top of
	// opening Profile, whose WebGL scenes keep the main thread busy; on a loaded or software-GL runner the walk
	// alone can pass the default 60s
	test.slow();
	const section = await openReviews(page);
	await expect(section.locator('[data-review-slide]')).toHaveCount(10);
	await expect(section).not.toContainText('Need to get this ASAP');
	// NOTE • Measured in one round trip: the open Profile keeps several WebGL scenes busy, and each separate
	// query costs the walk below enough time to outrun the test timeout on a loaded machine
	const activeSlide = () =>
		section.evaluate(el => {
			const top = el.getBoundingClientRect().top;
			const slide = el.querySelector('[data-active=true]');
			// Every slide has a portrait; a company logo sits beside it when the review has one (CMS content)
			const images = Array.from(
				slide?.querySelectorAll<HTMLImageElement>('[data-review-face] img, [data-review-logo] img') ?? []
			);
			return {
				height: el.getBoundingClientRect().height,
				authorOffset: (slide?.querySelector('figcaption')?.getBoundingClientRect().top ?? 0) - top,
				portraits: slide?.querySelectorAll('[data-review-face] img').length ?? 0,
				// Loaded, and drawn at a size (they scale in from zero as the slide arrives)
				imagesShown: images.every(image => image.naturalWidth > 0 && image.getBoundingClientRect().width > 0),
			};
		});
	// Baselines the layout must hold across all slides
	const initial = await activeSlide();

	// One step forward, then back past the start wraps to the last slide
	await section.getByRole('button', { name: 'Next review' }).click();
	await expect(section).toHaveAttribute('data-animating', 'true');
	await expect(section).toHaveAttribute('data-active-review', '1');
	await expect(section.locator('[data-active=true]')).toContainText('Jillian Phyllis');
	expect((await activeSlide()).height).toBeCloseTo(initial.height, 0);
	await section.getByRole('button', { name: 'Previous review' }).click();
	await expect(section).toHaveAttribute('data-active-review', '0');
	await section.getByRole('button', { name: 'Previous review' }).click();
	await expect(section).toHaveAttribute('data-active-review', '9');
	await expect(section.locator('[data-active=true]')).toContainText('Jamar Demorin');

	// Walk the whole carousel
	for (let index = 0; index < 10; index++) {
		await section.getByRole('button', { name: 'Next review' }).click();
		await expect(section).toHaveAttribute('data-active-review', String(index));
		const slide = await activeSlide();
		expect(slide.height).toBeCloseTo(initial.height, 0);
		expect(slide.authorOffset).toBeCloseTo(initial.authorOffset, 0);
		expect(slide.portraits).toBe(1);
		await expect.poll(async () => (await activeSlide()).imagesShown).toBe(true);
	}
});

// Protects the Profile cursor: it sticks to the arrows and goes back to following when over the quote.
test('Review arrows attract the Profile cursor and release it on exit', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const section = await openReviews(page);
	const shell = page.locator('#profile-panel').locator('..');
	for (const name of ['Previous review', 'Next review']) {
		await section.getByRole('button', { name, exact: true }).hover();
		await expect(shell).toHaveAttribute('data-cursor', 'sticky');
	}
	await section.locator('[data-active=true] blockquote').hover();
	await expect(shell).toHaveAttribute('data-cursor', 'follow');
});

// Protects the phone layout and reduced motion: the keyboard works, slides switch without animating, and nothing
// overflows.
test('Reviews fit mobile and switch instantly with reduced motion', async ({ page }) => {
	await page.setViewportSize({ width: 390, height: 844 });
	await page.emulateMedia({ reducedMotion: 'reduce' });
	const section = await openReviews(page);
	await section.getByRole('button', { name: 'Next review' }).press('Enter');
	await expect(section).toHaveAttribute('data-active-review', '1');
	await expect(section).toHaveAttribute('data-animating', 'false');
	expect(await section.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
	await expect(section.locator('[data-active=true]')).toContainText('Jillian Phyllis');
});

// Protects closing Profile: the carousel is torn down and works again after reopening.
test('Reviews clean up on Profile close and work after reopening', async ({ page }) => {
	const section = await openReviews(page);
	await section.getByRole('button', { name: 'Next review' }).click();
	await page.getByRole('button', { name: 'Close profile', exact: true }).click();
	await expect(section).not.toHaveAttribute('data-enhanced', 'true');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	await section.scrollIntoViewIfNeeded();
	await expect(section).toHaveAttribute('data-enhanced', 'true');
	const active = Number(await section.getAttribute('data-active-review'));
	await section.getByRole('button', { name: 'Next review' }).click();
	await expect(section).toHaveAttribute('data-active-review', String((active + 1) % 10));
});
