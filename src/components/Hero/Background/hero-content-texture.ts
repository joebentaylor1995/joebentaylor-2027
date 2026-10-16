// Measure text runs in the DOM so CSS wrapping, grid placement and fonts remain authoritative.
// Targets the hero's text and SVG paths; this is not a general HTML/CSS rasteriser.
export function drawHeroContent(
	canvas: HTMLCanvasElement,
	host: HTMLElement,
	maxTexture: number,
	raster = document.createElement('canvas')
) {
	const bounds = canvas.getBoundingClientRect();
	const ratio = Math.min(window.devicePixelRatio || 1, 2, maxTexture / Math.max(bounds.width, bounds.height));
	const width = Math.max(1, Math.round(bounds.width * ratio));
	const height = Math.max(1, Math.round(bounds.height * ratio));
	if (raster.width !== width) raster.width = width;
	if (raster.height !== height) raster.height = height;
	const ctx = raster.getContext('2d');
	if (!ctx) throw new Error('Hero text canvas unavailable');
	ctx.setTransform(1, 0, 0, 1, 0, 0);
	ctx.clearRect(0, 0, width, height);
	ctx.setTransform(width / bounds.width, 0, 0, height / bounds.height, 0, 0);
	const content = host.querySelector<HTMLElement>('[data-hero-content]');
	if (!content) return raster;
	const opacity = (element: Element) => {
		let alpha = 1;
		for (let current: Element | null = element; current && current !== content; current = current.parentElement)
			alpha *= Number(getComputedStyle(current).opacity);
		return alpha;
	};
	const walker = document.createTreeWalker(content, NodeFilter.SHOW_TEXT);
	let node = walker.nextNode();
	while (node) {
		const parent = node.parentElement;
		if (parent && !parent.closest('svg') && node.textContent?.trim()) {
			const css = getComputedStyle(parent);
			if (css.display !== 'none' && css.visibility !== 'hidden') {
				ctx.save();
				ctx.font = `${css.fontStyle} ${css.fontWeight} ${css.fontSize} ${css.fontFamily}`;
				ctx.letterSpacing = css.letterSpacing === 'normal' ? '0px' : css.letterSpacing;
				ctx.fillStyle = css.color;
				ctx.globalAlpha = opacity(parent);
				const mask = parent.closest('[data-word-mask]')?.getBoundingClientRect();
				if (mask) {
					ctx.beginPath();
					ctx.rect(mask.left - bounds.left, mask.top - bounds.top, mask.width, mask.height);
					ctx.clip();
				}
				ctx.textBaseline = 'alphabetic';
				const range = document.createRange();
				const lines: { text: string; left: number; top: number; height: number }[] = [];
				for (let i = 0; i < node.textContent.length; i++) {
					range.setStart(node, i);
					range.setEnd(node, i + 1);
					const rect = range.getBoundingClientRect();
					if (!rect.width || !rect.height) continue;
					let line = lines[lines.length - 1];
					if (!line || Math.abs(line.top - rect.top) > 1) {
						line = { text: '', left: rect.left, top: rect.top, height: rect.height };
						lines.push(line);
					}
					line.text += node.textContent[i];
				}
				for (const line of lines) {
					let text = line.text;
					if (css.textTransform === 'uppercase') text = text.toUpperCase();
					if (css.textTransform === 'lowercase') text = text.toLowerCase();
					const metrics = ctx.measureText(text);
					const ascent = metrics.fontBoundingBoxAscent;
					const descent = metrics.fontBoundingBoxDescent;
					ctx.fillText(
						text,
						line.left - bounds.left,
						line.top - bounds.top + (line.height - ascent - descent) / 2 + ascent
					);
				}
				ctx.restore();
			}
		}
		node = walker.nextNode();
	}
	// Reuse the actual heading icon paths, including their SVG transforms and CSS fill.
	for (const path of content.querySelectorAll<SVGPathElement>('svg path')) {
		const matrix = path.getScreenCTM();
		const css = getComputedStyle(path);
		if (!matrix || css.visibility === 'hidden' || css.display === 'none') continue;
		ctx.save();
		ctx.transform(matrix.a, matrix.b, matrix.c, matrix.d, matrix.e - bounds.left, matrix.f - bounds.top);
		ctx.fillStyle = css.fill;
		ctx.globalAlpha = opacity(path);
		ctx.fill(new Path2D(path.getAttribute('d') || ''));
		ctx.restore();
	}
	const wipe = content.querySelector<HTMLElement>('[data-heading-wipe]');
	if (wipe) {
		const box = wipe.getBoundingClientRect();
		ctx.fillStyle = getComputedStyle(wipe).backgroundColor;
		ctx.fillRect(box.left - bounds.left, box.top - bounds.top, box.width, box.height);
	}
	return raster;
}
