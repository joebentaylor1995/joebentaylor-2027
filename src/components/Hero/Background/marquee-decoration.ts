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

export function drawMarqueeDecoration(
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	maxTexture: number,
	phrase?: string
) {
	const bounds = canvas.getBoundingClientRect();
	const raster = document.createElement('canvas');
	const ratio = Math.min(window.devicePixelRatio || 1, 2, maxTexture / Math.max(bounds.width, bounds.height));
	raster.width = Math.max(1, Math.round(bounds.width * ratio));
	raster.height = Math.max(1, Math.round(bounds.height * ratio));
	const ctx = raster.getContext('2d');
	if (!ctx) throw new Error('Marquee decoration canvas unavailable');
	ctx.scale(raster.width / bounds.width, raster.height / bounds.height);
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
	const width = h.width + metrics.width - ctx.measureText(originalText).width;
	ctx.fillStyle = css.backgroundColor;
	ctx.fillRect(h.left - bounds.left, h.top - bounds.top, width, h.height);
	ctx.fillStyle = css.color;
	const lineHeight = parseFloat(css.lineHeight) || parseFloat(css.fontSize) * 1.2;
	const ascent = metrics.fontBoundingBoxAscent;
	const descent = metrics.fontBoundingBoxDescent;
	ctx.fillText(
		text,
		h.left - bounds.left + left,
		h.top - bounds.top + top + (lineHeight - ascent - descent) / 2 + ascent
	);
	return raster;
}
