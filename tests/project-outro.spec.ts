import { expect, test } from './helpers/test';

for (const mobile of [false, true]) {
	test(`project outro rises and reverses on ${mobile ? 'mobile' : 'desktop'}`, async ({ page }) => {
		if (mobile) await page.setViewportSize({ width: 440, height: 780 });
		await page.goto('/projects/pocketchange/');
		await page.getByRole('button', { name: 'Accept Necessary' }).click();
		await expect(page.locator('[data-loader-overlay]')).not.toBeVisible({ timeout: 15000 });
		const outro = page.locator('[data-project-outro]');
		const quote = outro.locator('[data-reveal-variant="words"]');
		await expect(quote.locator('[data-reveal-word]').first()).toBeAttached();
		const scroller = page.locator('#page .lenis').first();
		const progress = () =>
			outro.evaluate(el => Number(getComputedStyle(el).getPropertyValue('--project-outro-progress')));
		await expect.poll(progress).toBe(0);
		await expect(outro.locator('[data-page-title-reveal]').first()).toHaveAttribute('data-wave-state', 'waiting');
		await expect
			.poll(() =>
				outro.locator('[data-outro-portrait]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)
			)
			.toBe(0);
		await scroller.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
		await expect.poll(progress).toBeCloseTo(1, 2);
		await expect(outro.getByText('Jillian Phyllis')).toBeVisible();
		const next = outro.locator('[data-next-project]');
		await expect(next).toHaveAttribute('data-disabled', 'true');
		for (const text of await outro.locator('[data-page-title-reveal]').all()) {
			await expect(text).toHaveAttribute('data-wave-state', 'complete');
		}
		await expect
			.poll(() =>
				outro.locator('[data-outro-portrait]').evaluate(el => new DOMMatrix(getComputedStyle(el).transform).a)
			)
			.toBe(1);
		await expect
			.poll(() =>
				outro
					.getByRole('img', { name: 'Jillian Phyllis' })
					.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)
			)
			.toBe(true);
		const bounds = await outro.boundingBox();
		expect(bounds?.height).toBeCloseTo(mobile ? 780 : 900, 0);
		await page.screenshot({ path: `test-results/project-outro-${mobile ? 'mobile' : 'desktop'}.png` });
		if (!mobile) {
			await next.hover();
			await expect(next).toHaveCSS('--hover-fill', '111');
			await page.mouse.move(10, 10);
			await expect(next).toHaveCSS('--hover-fill', '-16');
		}
		await scroller.evaluate(el => el.scrollTo({ top: el.scrollTop - innerHeight * 0.175, behavior: 'instant' }));
		await expect.poll(progress).toBeCloseTo(0.5, 1);
		await scroller.evaluate(el => el.scrollTo({ top: el.scrollTop - innerHeight * 0.325, behavior: 'instant' }));
		await expect.poll(progress).toBe(0);
		await scroller.evaluate(el => el.scrollTo({ top: 0, behavior: 'instant' }));
		await expect.poll(progress).toBe(0);
		await expect(quote).toHaveAttribute('data-wave-state', 'waiting');
		await expect(quote.locator('[data-reveal-word]').first()).toHaveCSS('opacity', '0');
		await scroller.evaluate(el => el.scrollTo({ top: el.scrollHeight, behavior: 'instant' }));
		await expect(quote).toHaveAttribute('data-wave-state', 'complete');
		await expect(quote.locator('[data-reveal-word]').last()).toHaveCSS('opacity', '1');
	});
}
