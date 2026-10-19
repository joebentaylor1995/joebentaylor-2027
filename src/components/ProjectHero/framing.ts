export const HERO_PARALLAX_COMPENSATION = 0.6;

export function heroFrame(height: number, viewport: number, parallax: boolean) {
	const top = parallax ? -Math.max(0, height - viewport) * HERO_PARALLAX_COMPENSATION : 0;
	return { top, height: height - top };
}
