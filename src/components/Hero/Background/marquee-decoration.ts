// Constants
// ------------
// Rasterise the stationary marquee decoration from its rendered CSS layout.
// The scrolling logo texture remains separate so the heading and rule stay fixed.
// The desktop label cycles through these, one per scroll gesture (see liquid.ts).
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

// Types
// ------------
// NOTE • The marquee's top rule and label as the DOM lays them out, in CSS px relative to the
// canvas. Reading it once lets a label transition repaint every frame without layout or
// style reads; anything that could change it (a resize, fonts, theme) re-rasterises the
// whole decoration through liquid.ts, which ends the transition.
interface RuleLayout {
	left: number;
	top: number;
	width: number;
	height: number;
	colour: string;
}

interface LabelStyle {
	opacity: number;
	color: string;
	backgroundColor: string;
	// The label's own text (innerText), before any text-transform
	original: string;
	isMobile: boolean;
	insetLeft: number;
	insetTop: number;
	lineHeight: number;
	columnGap: number;
	// The mobile label's flanking rules (::before); only read on mobile
	ruleColour: string;
}

interface LabelLayout {
	left: number;
	top: number;
	width: number;
	height: number;
	// The computed `font` as read (it can be empty), and the font the label is painted in
	font: string;
	paintFont: string;
	letterSpacing: string;
	textTransform: string;
	// Null while the label is display: none or visibility: hidden: only the rule is painted
	style: LabelStyle | null;
}

interface DecorationLayout {
	// The canvas's size in CSS px
	width: number;
	height: number;
	rule: RuleLayout | null;
	// Null without a marquee heading
	label: LabelLayout | null;
}

type Measure = (text: string) => TextMetrics;

// Helpers
// ------------
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);

const applyTextTransform = (text: string, transform: string) =>
	transform === 'uppercase' ? text.toUpperCase() : transform === 'lowercase' ? text.toLowerCase() : text;

const textureRatio = (width: number, height: number, maxTexture: number) =>
	Math.min(window.devicePixelRatio || 1, 2, maxTexture / Math.max(width, height));

// Reads the rule and label from the DOM, relative to the canvas bounds
const readDecoration = (host: HTMLElement, bounds: DOMRect): DecorationLayout => {
	const layout: DecorationLayout = { width: bounds.width, height: bounds.height, rule: null, label: null };

	// Top rule: the marquee's CSS top border
	const marquee = host.querySelector<HTMLElement>('[data-logo-marquee]');
	if (!marquee) return layout;
	const box = marquee.getBoundingClientRect();
	const style = getComputedStyle(marquee);
	const border = parseFloat(style.borderTopWidth) || 0;
	if (border && style.borderTopStyle !== 'none')
		layout.rule = {
			left: box.left - bounds.left,
			top: box.top - bounds.top,
			width: box.width,
			height: border,
			colour: style.borderTopColor,
		};

	// Label: the heading's box, font, colour and spacing
	const heading = marquee.querySelector('h2');
	if (!heading) return layout;
	const h = heading.getBoundingClientRect();
	const css = getComputedStyle(heading);
	const visible = css.display !== 'none' && css.visibility !== 'hidden';
	const isMobile = css.display === 'flex';
	layout.label = {
		left: h.left - bounds.left,
		top: h.top - bounds.top,
		width: h.width,
		height: h.height,
		font: css.font,
		paintFont: css.font || `${css.fontWeight} ${css.fontSize} ${css.fontFamily}`,
		letterSpacing: css.letterSpacing === 'normal' ? '0px' : css.letterSpacing,
		textTransform: css.textTransform,
		style: visible
			? {
					opacity: Number(css.opacity),
					color: css.color,
					backgroundColor: css.backgroundColor,
					// Only measure the visible responsive label, not its hidden mobile sibling.
					// biome-ignore lint/performance/useDomNodeTextContent: innerText leaves out the hidden label
					original: heading.innerText.trim(),
					isMobile,
					insetLeft: parseFloat(css.paddingLeft) + (parseFloat(css.borderLeftWidth) || 0),
					insetTop: parseFloat(css.paddingTop) + (parseFloat(css.borderTopWidth) || 0),
					lineHeight: parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.2,
					columnGap: parseFloat(css.columnGap) || 0,
					ruleColour: isMobile ? getComputedStyle(heading, '::before').backgroundColor : '',
				}
			: null,
	};
	return layout;
};

// NOTE • Each character is placed by the width of everything before it, which keeps
// the phrase's kerning, and travels on its own stagger
const drawCharacters = (
	ctx: CanvasRenderingContext2D,
	text: string,
	x: number,
	y: number,
	offset: (eased: number) => number,
	progress: number,
	measure: Measure
) => {
	const characters = Array.from(text);
	const stagger = Math.min(CHARACTER_STAGGER, MAX_TOTAL_STAGGER / Math.max(1, characters.length - 1));
	const travel = 1 - stagger * (characters.length - 1);
	let before = '';
	characters.forEach((character, index) => {
		const eased = easeInOutCubic(clamp01((progress - index * stagger) / travel));
		ctx.fillText(character, x + measure(before).width, y + offset(eased));
		before += character;
	});
};

// Draws the marquee's top rule and label onto `ctx`. A plain string replaces the desktop
// label text; the mobile label is drawn as it is in the DOM.
const paintDecoration = (
	ctx: CanvasRenderingContext2D,
	layout: DecorationLayout,
	label?: string | LabelTransition,
	measure: Measure = text => ctx.measureText(text)
) => {
	const raster = ctx.canvas;
	const phrase = typeof label === 'string' ? label : label?.to;
	const transition = typeof label === 'object' ? label : undefined;

	const { rule } = layout;
	if (rule) {
		ctx.fillStyle = rule.colour;
		ctx.fillRect(rule.left, rule.top, rule.width, rule.height);
	}

	const h = layout.label;
	const css = h?.style;
	if (!h || !css) return raster;
	ctx.globalAlpha = css.opacity;
	ctx.font = h.paintFont;
	ctx.letterSpacing = h.letterSpacing;
	ctx.fillStyle = css.color;
	ctx.textBaseline = 'alphabetic';

	const text = applyTextTransform(css.isMobile ? css.original : (phrase ?? css.original), h.textTransform);
	const metrics = measure(text);

	if (css.isMobile) {
		// Match the centred mobile label and its two flex rules.
		const x = h.left + (h.width - metrics.width) / 2;
		const y = h.top;
		const gap = css.columnGap;
		ctx.fillStyle = css.ruleColour;
		const lineWidth = Math.max(0, (h.width - metrics.width) / 2 - gap);
		ctx.fillRect(h.left, y + h.height / 2, lineWidth, 1);
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
	const originalText = applyTextTransform(css.original, h.textTransform);
	const extra = h.width - measure(originalText).width;
	const fromText = applyTextTransform(transition?.from ?? '', h.textTransform);
	const width =
		extra +
		(transition
			? measure(fromText).width + (metrics.width - measure(fromText).width) * easeInOutCubic(transition.progress)
			: metrics.width);
	ctx.fillStyle = css.backgroundColor;
	ctx.fillRect(h.left, h.top, width, h.height);
	ctx.fillStyle = css.color;
	const ascent = metrics.fontBoundingBoxAscent;
	const descent = metrics.fontBoundingBoxDescent;
	const textX = h.left + css.insetLeft;
	const textY = h.top + css.insetTop + (css.lineHeight - ascent - descent) / 2 + ascent;
	if (!transition) {
		ctx.fillText(text, textX, textY);
		return raster;
	}
	// NOTE • Clipped to the label's own box, so characters never travel over the logos
	ctx.save();
	ctx.beginPath();
	ctx.rect(h.left, h.top, width, h.height);
	ctx.clip();
	drawCharacters(ctx, fromText, textX, textY, eased => -eased * h.height, transition.progress, measure);
	drawCharacters(ctx, text, textX, textY, eased => (1 - eased) * h.height, transition.progress, measure);
	ctx.restore();
	return raster;
};

// NOTE • Clears the patch and resets its context to defaults, exactly as assigning its size
// does; reset() skips reallocating the canvas when the size is unchanged
const resetPatch = (patch: HTMLCanvasElement, ctx: CanvasRenderingContext2D, width: number, height: number) => {
	if (patch.width === width && patch.height === height && typeof ctx.reset === 'function') ctx.reset();
	else {
		patch.width = width;
		patch.height = height;
	}
};

// Exports
// ------------
// Pass `raster` to reuse a canvas between redraws: assigning its size resets it exactly
// like a new one
export function drawMarqueeDecoration(
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	maxTexture: number,
	phrase?: string,
	raster = document.createElement('canvas')
) {
	const bounds = canvas.getBoundingClientRect();
	const ratio = textureRatio(bounds.width, bounds.height, maxTexture);
	raster.width = Math.max(1, Math.round(bounds.width * ratio));
	raster.height = Math.max(1, Math.round(bounds.height * ratio));
	const ctx = raster.getContext('2d');
	if (!ctx) throw new Error('Marquee decoration canvas unavailable');
	ctx.scale(raster.width / bounds.width, raster.height / bounds.height);
	return paintDecoration(ctx, readDecoration(host, bounds), phrase);
}

// NOTE • A phrase change repaints only the label's box each frame: re-uploading the whole
// decoration texture every frame would stall the hero. The layout and the label's text
// widths are read on the transition's first frame and reused by the rest (the canvas
// state they're measured in is identical every frame), so a frame is paint only.
// The returned function draws one frame at `progress` into `patch` and returns where the
// patch sits in the decoration texture, counted from its bottom edge as WebGL does.
export function createLabelTransition(
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	maxTexture: number,
	from: string,
	to: string
) {
	const layout = readDecoration(host, canvas.getBoundingClientRect());
	const widths = new Map<string, TextMetrics>();

	return (progress: number, patch: HTMLCanvasElement) => {
		const label = layout.label;
		if (!label) return null;
		const ratio = textureRatio(layout.width, layout.height, maxTexture);
		const textureWidth = Math.max(1, Math.round(layout.width * ratio));
		const textureHeight = Math.max(1, Math.round(layout.height * ratio));
		const scaleX = textureWidth / layout.width;
		const scaleY = textureHeight / layout.height;
		const ctx = patch.getContext('2d');
		if (!ctx) return null;
		// Sized with the patch's current font state, as before the reset below
		ctx.font = label.font;
		ctx.letterSpacing = label.letterSpacing;
		const widest = Math.max(
			ctx.measureText(applyTextTransform(from, label.textTransform)).width,
			ctx.measureText(applyTextTransform(to, label.textTransform)).width
		);
		const left = Math.floor(label.left * scaleX);
		const top = Math.floor(label.top * scaleY);
		const width = Math.min(textureWidth - left, Math.ceil((label.width + widest) * scaleX));
		const height = Math.min(textureHeight - top, Math.ceil(label.height * scaleY) + 1);
		if (width <= 0 || height <= 0) return null;
		resetPatch(patch, ctx, width, height);
		ctx.setTransform(scaleX, 0, 0, scaleY, -left, -top);
		const measure = (text: string) => {
			let metrics = widths.get(text);
			if (!metrics) {
				metrics = ctx.measureText(text);
				widths.set(text, metrics);
			}
			return metrics;
		};
		paintDecoration(ctx, layout, { from, to, progress }, measure);
		return { x: left, y: textureHeight - top - height };
	};
}
