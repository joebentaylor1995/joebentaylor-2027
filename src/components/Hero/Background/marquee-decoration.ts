// Rasterise the stationary marquee decoration from its rendered CSS layout.
// The scrolling logo texture remains separate so the heading and rule stay fixed.
export const marqueePhrases = [
	'Trusted by',
	'Loved by',
	'Designed for',
	'Built for',
	'Created for',
	'Partnered with',
	'Chosen by',
];

export interface LabelTransition {
	from: string;
	to: string;
	// 0–1
	progress: number;
}

// Constants
// ------------
// NOTE • Later characters start this much later, capped so a long phrase still
// leaves each one time to travel
const CHARACTER_STAGGER = 0.04;
const MAX_TOTAL_STAGGER = 0.5;

// Helpers
// ------------
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const applyTextTransform = (text: string, transform: string) =>
	transform === 'uppercase' ? text.toUpperCase() : transform === 'lowercase' ? text.toLowerCase() : text;

// NOTE • Each character is placed by the width of everything before it, which keeps
// the phrase's kerning, and travels on its own stagger
const drawCharacters = (
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	offset: (eased: number) => number,
	progress: number
) => {
	const characters = Array.from(text);
	const stagger = Math.min(CHARACTER_STAGGER, MAX_TOTAL_STAGGER / Math.max(1, characters.length - 1));
	const travel = 1 - stagger * (characters.length - 1);
	characters.forEach((character, index) => {
		const eased = easeInOutCubic(clamp01((progress - index * stagger) / travel));
		const before = characters.slice(0, index).join('');
		ctx.fillText(character, x + ctx.measureText(before).width, y + offset(eased));
	});
};

const paintDecoration = (
	ctx: CanvasRenderingContext2D,
	bounds: DOMRect,
	host: HTMLElement,
	label?: string | LabelTransition
) => {
	const raster = ctx.canvas;
	const phrase = typeof label === 'string' ? label : label?.to;
	const transition = typeof label === 'object' ? label : undefined;
	const marquee = host.querySelector<HTMLElement>('[data-logo-marquee]');
	if (!marquee) return raster;
	const box = marquee.getBoundingClientRect();
	const style = getComputedStyle(marquee);
	const border = parseFloat(style.borderTopWidth) || 0;
	if (border && style.borderTopStyle !== 'none') {
		ctx.fillStyle = style.borderTopColor;
		ctx.fillRect(box.left - bounds.left, box.top - bounds.top, box.width, border);
	}
	const heading = marquee.querySelector('h2');
	if (!heading) return raster;
	const h = heading.getBoundingClientRect();
	const css = getComputedStyle(heading);
	if (css.display === 'none' || css.visibility === 'hidden') return raster;
	ctx.globalAlpha = Number(css.opacity);
	ctx.font = css.font || `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
	ctx.letterSpacing = css.letterSpacing === 'normal' ? '0px' : css.letterSpacing;
	ctx.fillStyle = css.color;
	ctx.textBaseline = 'alphabetic';
	// Only measure the visible responsive label, not its hidden mobile sibling.
	const original = heading.innerText.trim();
	const isMobile = css.display === 'flex';
	let text = isMobile ? original : (phrase ?? original);
	if (css.textTransform === 'uppercase') text = text.toUpperCase();
	else if (css.textTransform === 'lowercase') text = text.toLowerCase();
	const left = parseFloat(css.paddingLeft) + (parseFloat(css.borderLeftWidth) || 0);
	const top = parseFloat(css.paddingTop) + (parseFloat(css.borderTopWidth) || 0);
	const metrics = ctx.measureText(text);
	if (isMobile) {
		// Match the centred mobile label and its two flex rules.
		const x = h.left - bounds.left + (h.width - metrics.width) / 2;
		const y = h.top - bounds.top;
		const gap = parseFloat(css.columnGap) || 0;
		const line = getComputedStyle(heading, '::before');
		ctx.fillStyle = line.backgroundColor;
		const lineWidth = Math.max(0, (h.width - metrics.width) / 2 - gap);
		ctx.fillRect(h.left - bounds.left, y + h.height / 2, lineWidth, 1);
		ctx.fillRect(x + metrics.width + gap, y + h.height / 2, lineWidth, 1);
		ctx.fillStyle = css.color;
		ctx.fillText(
			text,
			x,
			y +
				(h.height - metrics.fontBoundingBoxAscent - metrics.fontBoundingBoxDescent) / 2 +
				metrics.fontBoundingBoxAscent
		);
		return raster;
	}
	// Preserve the HTML's padding and responsive position as the label gets longer.
	const originalText =
		css.textTransform === 'uppercase'
			? original.toUpperCase()
			: css.textTransform === 'lowercase'
				? original.toLowerCase()
				: original;
	const extra = h.width - ctx.measureText(originalText).width;
	const fromText = applyTextTransform(transition?.from ?? '', css.textTransform);
	const width =
		extra +
		(transition
			? ctx.measureText(fromText).width +
				(metrics.width - ctx.measureText(fromText).width) * easeInOutCubic(transition.progress)
			: metrics.width);
	ctx.fillStyle = css.backgroundColor;
	ctx.fillRect(h.left - bounds.left, h.top - bounds.top, width, h.height);
	ctx.fillStyle = css.color;
	const lineHeight = parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.2;
	const ascent = metrics.fontBoundingBoxAscent;
	const descent = metrics.fontBoundingBoxDescent;
	const textX = h.left - bounds.left + left;
	const textY = h.top - bounds.top + top + (lineHeight - ascent - descent) / 2 + ascent;
	if (!transition) {
		ctx.fillText(text, textX, textY);
		return raster;
	}
	// NOTE • Clipped to the label's own box, so characters never travel over the logos
	ctx.save();
	ctx.beginPath();
	ctx.rect(h.left - bounds.left, h.top - bounds.top, width, h.height);
	ctx.clip();
	drawCharacters(ctx, fromText, textX, textY, eased => -eased * h.height, transition.progress);
	drawCharacters(ctx, text, textX, textY, eased => (1 - eased) * h.height, transition.progress);
	ctx.restore();
	return raster;
};

const textureRatio = (bounds: DOMRect, maxTexture: number) =>
	Math.min(window.devicePixelRatio || 1, 2, maxTexture / Math.max(bounds.width, bounds.height));

// Exports
// ------------
export function drawMarqueeDecoration(
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	maxTexture: number,
	phrase?: string
) {
	const bounds = canvas.getBoundingClientRect();
	const raster = document.createElement('canvas');
	const ratio = textureRatio(bounds, maxTexture);
	raster.width = Math.max(1, Math.round(bounds.width * ratio));
	raster.height = Math.max(1, Math.round(bounds.height * ratio));
	const ctx = raster.getContext('2d');
	if (!ctx) throw new Error('Marquee decoration canvas unavailable');
	ctx.scale(raster.width / bounds.width, raster.height / bounds.height);
	return paintDecoration(ctx, bounds, host, phrase);
}

// NOTE • One frame of a phrase change, covering only the label's box: re-uploading
// the whole decoration texture every frame would stall the hero. Returns where the
// patch sits in that texture, counted from its bottom edge as WebGL does.
export function drawMarqueeLabelFrame(
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	maxTexture: number,
	transition: LabelTransition,
	patch: HTMLCanvasElement
) {
	const heading = host.querySelector<HTMLElement>('[data-logo-marquee] h2');
	if (!heading) return null;
	const bounds = canvas.getBoundingClientRect();
	const h = heading.getBoundingClientRect();
	const css = getComputedStyle(heading);
	const ratio = textureRatio(bounds, maxTexture);
	const textureWidth = Math.max(1, Math.round(bounds.width * ratio));
	const textureHeight = Math.max(1, Math.round(bounds.height * ratio));
	const scaleX = textureWidth / bounds.width;
	const scaleY = textureHeight / bounds.height;
	const ctx = patch.getContext('2d');
	if (!ctx) return null;
	ctx.font = css.font;
	ctx.letterSpacing = css.letterSpacing === 'normal' ? '0px' : css.letterSpacing;
	const widest = Math.max(
		ctx.measureText(applyTextTransform(transition.from, css.textTransform)).width,
		ctx.measureText(applyTextTransform(transition.to, css.textTransform)).width
	);
	const left = Math.floor((h.left - bounds.left) * scaleX);
	const top = Math.floor((h.top - bounds.top) * scaleY);
	const width = Math.min(textureWidth - left, Math.ceil((h.width + widest) * scaleX));
	const height = Math.min(textureHeight - top, Math.ceil(h.height * scaleY) + 1);
	if (width <= 0 || height <= 0) return null;
	patch.width = width;
	patch.height = height;
	ctx.setTransform(scaleX, 0, 0, scaleY, -left, -top);
	paintDecoration(ctx, bounds, host, transition);
	return { x: left, y: textureHeight - top - height };
}
