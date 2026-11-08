// Case study image sizes
// ------------
// NOTE • The `sizes` hints for case study media, so the browser downloads an
// image as wide as the tile it fills. Measured from the rendered layouts:
//
// - Below 1024px, tiles span the screen less the page padding.
// - From 1024px, with a mouse and motion allowed, the case study sits in a
//   column beside the hero (ProjectExperience's enhanced layout). That column
//   follows calc(67.65vw - 80px) up to 1440px, holds at 894px to 1600px, then
//   grows with the root font size (0.625vw, see global.scss) as 89.4rem = 55.9vw.
// - Touch screens and reduced motion keep the plain full-width layout: 95vw.
//
// Each list states the plain layout before the column ranges, since the
// browser takes the first condition that matches.

// Helpers
// ------------
// NOTE • The conditions under which a desktop-width window keeps the plain layout
const PLAIN_LAYOUT = ['(prefers-reduced-motion: reduce)', '(hover: none)', '(pointer: coarse)'];

const sizesFor = ({
	mobile,
	plain,
	column,
	held,
	wide,
}: {
	mobile: string;
	plain: string;
	column: string;
	held: string;
	wide: string;
}) =>
	[
		`(max-width: 1023px) ${mobile}`,
		...PLAIN_LAYOUT.map(query => `${query} ${plain}`),
		`(max-width: 1440px) ${column}`,
		`(max-width: 1600px) ${held}`,
		wide,
	].join(', ');

// Exports
// ------------
// A full-width tile
export const SINGLE_SIZES = sizesFor({
	mobile: 'calc(100vw - 32px)',
	plain: '95vw',
	column: 'calc(67.65vw - 80px)',
	held: '894px',
	wide: '55.9vw',
});

// One tile of a two-up (stacked full width below 1024px)
export const DUAL_SIZES = sizesFor({
	mobile: 'calc(100vw - 32px)',
	plain: '47.3vw',
	column: 'calc(33.825vw - 44px)',
	held: '443px',
	wide: '27.7vw',
});

// NOTE • Scatter Drift's cards are two-thirds of a two-up tile's width
export const DUAL_GALLERY_SIZES = sizesFor({
	mobile: '66vw',
	plain: '32vw',
	column: '23vw',
	held: '300px',
	wide: '18.5vw',
});

// NOTE • A standalone gallery's largest card (Panorama's) is about 64% of a full-width tile
export const GALLERY_SIZES = sizesFor({
	mobile: '60vw',
	plain: '61vw',
	column: '40vw',
	held: '560px',
	wide: '35.8vw',
});
