// Imports
// ------------
import { expect, type Page, test } from './helpers/test';

// Helpers
// ------------
// Opens Profile, scrolls to Reviews and waits for the carousel to enhance
async function openReviews(page: Page) {
	await page.goto('/');
	await page.getByRole('button', { name: 'Open Profile', exact: true }).click();
	const section = page.locator('[data-reviews]');
	await section.scrollIntoViewIfNeeded();
	await expect(section).toHaveAttribute('data-enhanced', 'true');
	return section;
}

// Tests
// ------------
// Protects the Reviews carousel: ten slides, Next and Previous wrap in both directions, the section height and
// author position never jump between slides, and every portrait loads.
test('Reviews animate, wrap in both directions, and keep all portraits and logos available', async ({ page }) => {
	const section = await openReviews(page);
	await expect(section.locator('[data-review-slide]')).toHaveCount(10);
	await expect(section).not.toContainText('Need to get this ASAP');
	// Baselines the layout must hold across all slides
	const initialHeight = (await section.boundingBox())?.height;
	const authorOffset = () =>
		section.evaluate(el => {
			const author = el.querySelector('[data-active=true] figcaption');
			return (author?.getBoundingClientRect().top ?? 0) - el.getBoundingClientRect().top;
		});
	const initialAuthorOffset = await authorOffset();

	// One step forward, then back past the start wraps to the last slide
	await section.getByRole('button', { name: 'Next review' }).click();
	await expect(section).toHaveAttribute('data-animating', 'true');
	await expect(section).toHaveAttribute('data-active-review', '1');
	await expect(section.locator('[data-active=true]')).toContainText('Jillian Phyllis');
	expect((await section.boundingBox())?.height).toBeCloseTo(initialHeight ?? 0, 0);
	await section.getByRole('button', { name: 'Previous review' }).click();
	await expect(section).toHaveAttribute('data-active-review', '0');
	await section.getByRole('button', { name: 'Previous review' }).click();
	await expect(section).toHaveAttribute('data-active-review', '9');
	await expect(section.locator('[data-active=true]')).toContainText('Jamar Demorin');

	// Walk the whole carousel
	for (let index = 0; index < 10; index++) {
		await section.getByRole('button', { name: 'Next review' }).click();
		await expect(section).toHaveAttribute('data-active-review', String(index));
		expect((await section.boundingBox())?.height).toBeCloseTo(initialHeight ?? 0, 0);
		expect(await authorOffset()).toBeCloseTo(initialAuthorOffset, 0);
		const image = section.locator('[data-active=true] img');
		await expect(image).toBeVisible();
		await expect.poll(() => image.evaluate(el => (el as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
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
