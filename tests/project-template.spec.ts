// Imports
// ------------
import { expect, test } from '@playwright/test';

// Tests
// ------------
// Protects the desktop case study scroll choreography: the hero parallaxes and fades, the panel slides in over
// it, the cursor changes over the panel, Return to top resets everything, and a narrow viewport drops the
// enhanced layout.
test('desktop project reveal follows scroll in both directions and returns to top', async ({ page }) => {
	await page.goto('/projects/pocketchange/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
	const root = page.locator('[data-project-experience]');
	await expect(root).toHaveAttribute('data-enhanced', 'true');
	const scroller = page.locator('#page .lenis').first();
	const panel = page.locator('[data-project-panel]');
	const hero = page.locator('[data-project-hero-layer]');
	// start is the scroll distance where the hero has fully scrolled away; reveal is the panel slide distance (90% of
	// the viewport)
	const geometry = await hero.evaluate(el => ({ height: el.clientHeight, viewport: innerHeight }));
	const start = geometry.height - geometry.viewport;
	const reveal = geometry.viewport * 0.9;
	// Scroll the Lenis wrapper to an absolute position
	const move = async (top: number) => {
		await scroller.evaluate((el, y) => el.scrollTo({ top: y, behavior: 'instant' }), top);
	};
	const x = () => panel.evaluate(el => el.getBoundingClientRect().left);
	// The hero's right edge, as its clip-path closes over the panel beneath
	const heroEdge = () =>
		page.locator('[data-project-hero-clip]').evaluate(el => {
			const inset = /inset\(0px (\S+)px/.exec(getComputedStyle(el).clipPath)?.[1];
			return innerWidth - Number(inset ?? 0);
		});
	const mediaY = () =>
		page.locator('[data-project-hero-media]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).f);

	// Hero stage: media parallax at 30% of the scroll, text fully visible
	await move(start / 2);
	await expect.poll(mediaY).toBeCloseTo(start * 0.3, 0);
	await expect(page.locator('[data-project-hero]')).toHaveCSS('--project-text-opacity', '1');

	// Panel reveal: text fades out as the panel arrives
	await move(start + reveal * 0.35);
	await expect
		.poll(() =>
			page
				.locator('[data-project-hero]')
				.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--project-text-opacity')))
		)
		.toBeCloseTo(0.5, 1);

	// Half way: panel left edge between 800 and 1100px, hero lifted by the full start distance
	await move(start + reveal / 2);
	await expect(page.locator('[data-project-hero]')).toHaveCSS('--project-image-saturation', '0');
	await expect.poll(mediaY).toBeCloseTo(start * 0.6, 0);
	await expect.poll(heroEdge).toBeLessThan(1100);
	await expect.poll(heroEdge).toBeGreaterThan(800);
	await expect.poll(x).toBeLessThan(560);
	await expect
		.poll(() => hero.evaluate(el => new DOMMatrix(getComputedStyle(el).transform).f))
		.toBeCloseTo(-start, 0);

	// Past the reveal: panel at rest and its content scrolling
	await move(start + reveal + 300);
	await expect(page.locator('[data-project-hero]')).toHaveCSS('--project-text-opacity', '0');
	await expect.poll(mediaY).toBeCloseTo(start * 0.6, 0);
	await expect.poll(x).toBeCloseTo(466, 0);

	// Cursor follows over the hero side and goes native over the panel
	await page.mouse.move(1000, 400);
	const cursorHost = page.locator('[data-profile-scene]').locator('..');
	await expect(cursorHost).toHaveAttribute('data-cursor', 'follow');
	await page.mouse.move(200, 400);
	await expect(cursorHost).toHaveAttribute('data-cursor', 'close');
	await expect
		.poll(() =>
			page.locator('[data-project-panel-content]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).f)
		)
		.toBeCloseTo(-300, 0);
	await page.screenshot({ path: 'test-results/pocketchange-desktop-panel.png' });
	await move(start + reveal / 2);
	await expect.poll(heroEdge).toBeGreaterThan(800);
	await page
		.getByRole('button', { name: 'Return to the top of the project' })
		.click({ position: { x: 200, y: 450 } });
	await expect.poll(() => scroller.evaluate(el => el.scrollTop)).toBe(0);
	await expect(panel).toHaveAttribute('inert', '');
	await expect(page.locator('[data-project-hero]')).toHaveCSS('--project-text-opacity', '1');
	await page.screenshot({ path: 'test-results/pocketchange-desktop-hero.png' });

	// Narrow viewport falls back to the plain vertical layout
	await page.setViewportSize({ width: 440, height: 780 });
	await expect(root).not.toHaveAttribute('data-enhanced');
	await expect(panel).not.toHaveAttribute('inert');
	await expect(panel).toHaveCSS('transform', 'none');
});

// Protects the mobile layout: the hero is exactly one viewport, the overview follows it directly and there is
// no Return to top button.
test('mobile project flows vertically, with a full-size hero and accessible content', async ({ page }) => {
	await page.setViewportSize({ width: 440, height: 780 });
	await page.goto('/projects/pocketchange/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
	await expect(page.locator('[data-project-experience]')).not.toHaveAttribute('data-enhanced');
	const hero = await page.locator('[data-project-hero]').boundingBox();
	const panel = await page.locator('[data-project-panel]').boundingBox();
	// The hero is exactly one viewport; the overview follows straight after it
	expect(hero?.height).toBeCloseTo(780, 0);
	expect(panel?.y).toBeCloseTo((hero?.y ?? 0) + (hero?.height ?? 0), 0);
	await expect(page.getByRole('button', { name: 'Return to the top of the project' })).toBeHidden();
	await page
		.locator('#page .lenis')
		.first()
		.evaluate(el => el.scrollTo({ top: 280, behavior: 'instant' }));
	await page.screenshot({ path: 'test-results/pocketchange-mobile-hero.png' });
	await page.getByRole('heading', { name: 'Project Overview' }).scrollIntoViewIfNeeded();
	await expect(page.getByRole('heading', { name: 'Objectives' })).toBeVisible();
});

// Protects direct visits: reduced motion gets the plain layout, and an unknown slug shows the noindex 404.
test('direct project links work with reduced motion and unknown slugs show the not-found page', async ({ page }) => {
	await page.emulateMedia({ reducedMotion: 'reduce' });
	await page.goto('/projects/pocketchange/');
	await expect(page.getByRole('heading', { name: 'Pocketchange', exact: true })).toBeVisible();
	await expect(page.locator('[data-project-experience]')).not.toHaveAttribute('data-enhanced');
	await expect(page.locator('[data-project-panel]')).not.toHaveAttribute('inert');
	await page.goto('/projects/not-a-real-project/');
	// Suspense streams the shell with 200 before notFound() supplies the noindex page.
	await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
	await expect(page.locator('[data-project-experience]')).toHaveCount(0);
	await expect(page.locator('meta[name="robots"][content="noindex"]').first()).toBeAttached();
});
