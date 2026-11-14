// Imports
// ------------
import { expect, type Locator, type Page } from '@playwright/test';

// Constants
// ------------
// Covers a video's metadata arriving plus the case study's 200ms re-measure after it resizes
const MEDIA_SETTLE_MS = 1000;
const SETTLE_TIMEOUT = 20_000;

// Helpers
// ------------
// Scrolls a case study's Lenis wrapper to its real end. Posterless videos take their shape once
// their metadata loads, which can grow the page just after a jump to the end (and the scroll rightly
// keeps its place), so it jumps again until the height holds with the scroller at the bottom.
export const settleAtPageEnd = async (page: Page, scroller: Locator) => {
	await expect
		.poll(
			async () => {
				const height = await scroller.evaluate(element => {
					element.scrollTo({ top: element.scrollHeight, behavior: 'instant' });
					return element.scrollHeight;
				});
				await page.waitForTimeout(MEDIA_SETTLE_MS);
				return scroller.evaluate(
					(element, before) =>
						element.scrollHeight === before &&
						element.scrollTop + element.clientHeight >= element.scrollHeight - 1,
					height
				);
			},
			{ timeout: SETTLE_TIMEOUT }
		)
		.toBe(true);
};
