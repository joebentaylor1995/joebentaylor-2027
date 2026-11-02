// Constants
// ------------
// Share of the overflow (hero height beyond the viewport) the parallax pulls the frame up by
export const HERO_PARALLAX_COMPENSATION = 0.6;

// Where the hero's bottom shade starts, as a fraction of its height (styles.module.scss ::after)
export const HERO_SHADE_START = 0.59;

// Helpers
// ------------
// Returns the hero's vertical offset and resulting height; with parallax it is shifted up by the compensation
export function heroFrame(height: number, viewport: number, parallax: boolean) {
	const top = parallax ? -Math.max(0, height - viewport) * HERO_PARALLAX_COMPENSATION : 0;
	return { top, height: height - top };
}
