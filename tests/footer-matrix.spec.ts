// Imports
// ------------
import { expect, test } from '@playwright/test';
import { settleAtPageEnd } from './helpers/page-end';

// Tests
// ------------
// Protects the footer matrix on a case study: it renders the next project's title without debug controls,
// sits under the credits, reacts to hovering Next Project with the approved shader values, and on mobile
// ignores the hover and keeps the outro's dark background.
test('footer matrix approved defaults render without controls', async ({ page }) => {
	// Collect uncaught page errors; asserted empty at the end
	const errors: string[] = [];
	page.on('pageerror', e => errors.push(e.message));
	await page.goto('/projects/pocketchange/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	// The page scrolls inside a Lenis wrapper rather than the window, so jump its scroller to the end
	const bottom = () =>
		page
			.locator('#page .lenis')
			.first()
			.evaluate(e => e.scrollTo({ top: e.scrollHeight, behavior: 'instant' }));

	// Wait for the canvas to report ready before measuring it
	await bottom();
	const canvas = page.locator('[data-footer-matrix]');
	await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
	await expect(page.locator('[data-next-project]')).toHaveText('Next Project');
	// The glyphs are the next case study's title, upper-cased with a trailing space. Which project comes
	// next is CMS content, so read its title from its own page.
	const nextHref = await page.locator('[data-next-project]').getAttribute('href');
	if (!nextHref) throw new Error('Next Project has no link');
	const nextPage = await page.context().newPage();
	await nextPage.goto(nextHref, { waitUntil: 'domcontentloaded' });
	const nextTitle = (await nextPage.locator('#project-title').textContent())?.trim();
	await nextPage.close();
	if (!nextTitle) throw new Error('Next project has no title');
	await expect(canvas).toHaveAttribute('data-characters', `${nextTitle.toUpperCase()} `);

	// The matrix sits below the credit line. Both are read in the same frame, so a scroll between two
	// separate reads can't skew the comparison.
	const gap = await page.evaluate(() => {
		const matrix = document.querySelector('[data-footer-matrix]')?.getBoundingClientRect();
		const credit = document.querySelector('[data-project-outro] figcaption')?.getBoundingClientRect();
		return matrix && credit ? matrix.top - credit.bottom : null;
	});
	expect(gap).not.toBeNull();
	expect(gap).toBeGreaterThanOrEqual(-1);
	await expect(page.getByText('Footer matrix', { exact: true })).toHaveCount(0);
	// The outro is complete at the real end, once late media has settled
	await settleAtPageEnd(page, page.locator('#page .lenis').first());
	await expect
		.poll(() =>
			page
				.locator('[data-project-outro]')
				.evaluate(e => Number((e as HTMLElement).style.getPropertyValue('--project-outro-progress')))
		)
		.toBe(1);

	// Hover Next Project: the hover amount rises and the shader receives the approved settings
	await page.mouse.move(500, 200);
	await page.locator('[data-next-project]').hover();
	await expect.poll(() => canvas.getAttribute('data-hover').then(Number)).toBeGreaterThan(0.9);
	await expect
		.poll(() =>
			// Reads the current WebGL program uniforms directly from the canvas, rounded to 2dp
			canvas.evaluate((element: HTMLCanvasElement) => {
				const gl = element.getContext('webgl');
				if (!gl) return null;
				const program = gl.getParameter(gl.CURRENT_PROGRAM);
				return ['intensity', 'hoverSize', 'hoverGlow'].map(name => {
					const location = gl.getUniformLocation(program, name);
					return location ? Math.round(gl.getUniform(program, location) * 100) / 100 : null;
				});
			})
		)
		.toEqual([0.75, 1.15, 0.9]);

	// Narrow viewport: still ready, hover amount stays at 0, and the outro keeps its background colour
	await page.setViewportSize({ width: 440, height: 780 });
	await bottom();
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-ready', 'true');
	await page.locator('[data-next-project]').hover();
	await expect.poll(() => canvas.getAttribute('data-hover').then(Number)).toBe(0);
	// The blue gradient that used to rise behind it was removed in 6f6ace0; the outro stays dark
	await expect(page.locator('[data-project-outro]')).toHaveCSS('background-color', 'rgb(18, 18, 18)');
	expect(errors).toEqual([]);
});
