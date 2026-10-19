// Colour → @sanity/color-input value
// ------------
// NOTE • Turns a CSS colour ('#001e36', '#000', 'rgba(255,255,255,0.1)') into
// the object the Studio's colour picker stores, so seeded and migrated tiles
// open in the picker with the right swatch, hex and transparency.

// Types
// ------------
interface Rgba {
	r: number;
	g: number;
	b: number;
	a: number;
}

// Constants
// ------------
const CHANNEL_MAX = 255;
const DEGREES = 360;
const HEX_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;
const RGBA_PATTERN = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+)\s*)?\)$/i;

// Helpers
// ------------
const round = (value: number, places = 3) => Number(value.toFixed(places));
const toHexPair = (channel: number) => channel.toString(16).padStart(2, '0');

const parse = (css: string): Rgba => {
	const hex = css.trim().match(HEX_PATTERN)?.[1];
	if (hex) {
		const full = hex.length === 3 ? [...hex].map(digit => digit + digit).join('') : hex;
		return {
			r: Number.parseInt(full.slice(0, 2), 16),
			g: Number.parseInt(full.slice(2, 4), 16),
			b: Number.parseInt(full.slice(4, 6), 16),
			a: 1,
		};
	}
	const rgba = css.trim().match(RGBA_PATTERN);
	if (rgba) return { r: Number(rgba[1]), g: Number(rgba[2]), b: Number(rgba[3]), a: rgba[4] ? Number(rgba[4]) : 1 };
	throw new Error(`Unsupported colour: ${css}`);
};

// NOTE • Shared hue maths for HSL and HSV
const hueOf = (r: number, g: number, b: number, max: number, delta: number) => {
	if (!delta) return 0;
	const hue = max === r ? ((g - b) / delta) % 6 : max === g ? (b - r) / delta + 2 : (r - g) / delta + 4;
	return round((hue * 60 + DEGREES) % DEGREES, 1);
};

// Exports
// ------------
export const toSanityColour = (css: string) => {
	const { r, g, b, a } = parse(css);
	const [rn, gn, bn] = [r / CHANNEL_MAX, g / CHANNEL_MAX, b / CHANNEL_MAX];
	const max = Math.max(rn, gn, bn);
	const min = Math.min(rn, gn, bn);
	const delta = max - min;
	const h = hueOf(rn, gn, bn, max, delta);
	const l = (max + min) / 2;
	const hslS = delta ? delta / (1 - Math.abs(2 * l - 1)) : 0;
	const hsvS = max ? delta / max : 0;

	return {
		_type: 'color',
		hex: `#${toHexPair(r)}${toHexPair(g)}${toHexPair(b)}`,
		alpha: a,
		rgb: { _type: 'rgbaColor', r, g, b, a },
		hsl: { _type: 'hslaColor', h, s: round(hslS), l: round(l), a },
		hsv: { _type: 'hsvaColor', h, s: round(hsvS), v: round(max), a },
	};
};
