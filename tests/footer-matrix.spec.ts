import { expect, test } from './helpers/test';

test('footer matrix approved defaults render without controls', async ({ page }) => {
	const errors: string[] = [];
	page.on('pageerror', e => errors.push(e.message));
	await page.goto('/projects/pocketchange/');
	await page.getByRole('button', { name: 'Accept Necessary' }).click();
	await expect(page.locator('[data-site-loader]')).toBeHidden({ timeout: 15000 });
	const bottom = () =>
		page
			.locator('#page .lenis')
			.first()
			.evaluate(e => e.scrollTo({ top: e.scrollHeight, behavior: 'instant' }));
	await bottom();
	const canvas = page.locator('[data-footer-matrix]');
	await expect(canvas).toHaveAttribute('data-ready', 'true', { timeout: 15000 });
	await expect(canvas).toHaveAttribute('data-characters', 'JILLIAN PHYLLIS ');
	await expect(page.locator('[data-next-project]')).toHaveText('Next Project');
	const bounds = await canvas.boundingBox();
	const credit = await page.locator('[data-project-outro] figcaption').boundingBox();
	expect(bounds && credit && bounds.y >= credit.y + credit.height - 1).toBeTruthy();
	await expect(page.getByText('Footer matrix', { exact: true })).toHaveCount(0);
	await expect
		.poll(() =>
			page
				.locator('[data-project-outro]')
				.evaluate(e => Number((e as HTMLElement).style.getPropertyValue('--project-outro-progress')))
		)
		.toBe(1);
	await page.mouse.move(500, 200);
	await page.locator('[data-next-project]').hover();
	await expect.poll(() => canvas.getAttribute('data-hover').then(Number)).toBeGreaterThan(0.9);
	await expect
		.poll(() =>
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
	await page.setViewportSize({ width: 440, height: 780 });
	await bottom();
	await expect(canvas).toBeVisible();
	await expect(canvas).toHaveAttribute('data-ready', 'true');
	await page.locator('[data-next-project]').hover();
	await expect.poll(() => canvas.getAttribute('data-hover').then(Number)).toBe(0);
	await expect(page.locator('[data-project-outro]')).toHaveCSS('background-color', 'rgb(18, 18, 18)');
	expect(
		await page.locator('[data-project-outro]').evaluate(e => getComputedStyle(e, '::before').backgroundColor)
	).toBe('rgb(22, 83, 255)');
	expect(errors).toEqual([]);
});
