// Imports
// ------------
import { BEN, JOE, LOGO, LOGO_BOX, type Word } from './logoPaths';
import { loaderSettings } from './settings';

// NOTE • A frame-by-frame rebuild of the "JOE TAYLOR_01 FX" opening. The
// source is a 30fps edit of hard glitch cuts, so each beat is a discrete
// state held until the next one, not a tween. Sizes and offsets are fractions
// of the stage (the viewport, capped), so the scene scales like the video.

// Constants
// ------------
export const INTRO_FPS = 30;
const STROKE_PX = 1.5;
const STAGE_MAX = 1200;
const STAGE_ASPECT = 1.2;

const W = 'var(--global-white)';
const K = 'var(--global-black)';
const B = 'var(--brand-c8)';
const G = '#6b6b6b';

// Types
// ------------
export type WordKey = 'joe' | 'ben' | 'logo';

type Look = {
	fill?: string;
	stroke?: string;
	// Offset in glyph units, scale about the word's centre
	dx?: number;
	dy?: number;
	scale?: number;
	opacity?: number;
};

// Band edges as fractions of the word box: [top, bottom, left, right]
type Cut = Look & { box: [number, number, number?, number?] };

// Solid bars in stage fractions: [x0, y0, x1, y1]
type Bar = [number, number, number, number];

// NOTE • The band is a curved ultrawide (a Samsung Odyssey G9). Its width is the
// landed logo's; `height` 1 is the full screen height for loaderSettings.screenAspect
// (outer edge at the sides, rim included), and screenCurve pulls the middle in.
type Band = {
	height: number;
	// Blue rim thickness as a fraction of the band width
	rim?: number;
};

export type Frame = {
	word?: WordKey;
	// Word width as a fraction of the stage, and its vertical offset
	size?: number;
	y?: number;
	// Extra space between letters, in glyph units
	spread?: number;
	blur?: number;
	main?: Look;
	shadow?: Look;
	ghost?: Look;
	cuts?: Cut[];
	bars?: Bar[];
	band?: Band;
	clipToBand?: Band;
};

// Timeline
// ------------
// NOTE • Keyed by source frame (30fps). Frames 0–2 are the black lead-in.
const shadow = (dx = -1.5, dy = 1.5): Look => ({ fill: B, dx, dy });
const solid: Look = { fill: W };

const SCREEN: Band = { height: 1, rim: 0.003 };
// NOTE • The full logo's sizes below are authored against the video, where it lands
// at 0.63 of the stage. At render they're rescaled so it lands at the static mark's
// size instead — the zoom-out finishes on the mark itself, with no shrink after.
export const INTRO_SETTLE_SIZE = 0.63;

export const INTRO_FRAMES: Record<number, Frame> = {
	0: {},
	3: { word: 'joe', size: 0.78, y: 0.2, spread: 16, main: { stroke: W } },
	4: { word: 'joe', size: 0.78, y: 0.16, spread: 16, main: { stroke: G } },
	5: {
		word: 'joe',
		size: 0.78,
		y: 0.1,
		spread: 16,
		main: solid,
		cuts: [
			{ box: [0.5, 1, 0.3, 0.7], fill: K },
			{ box: [0, 0.45, 0.7, 1], fill: K, dx: -8 },
		],
	},
	6: {
		word: 'joe',
		size: 0.8,
		y: 0.07,
		spread: 12,
		main: solid,
		cuts: [
			{ box: [0, 0.5, 0, 0.65], fill: K, dx: 6 },
			{ box: [0.45, 1, 0.7, 1], fill: K, dx: -4 },
		],
	},
	7: {
		word: 'joe',
		size: 0.8,
		y: 0.07,
		spread: 12,
		main: solid,
		cuts: [
			{ box: [0, 0.35, 0, 0.6], fill: K },
			{ box: [0.4, 1, 0.7, 1], fill: K, dx: 3 },
		],
	},
	8: {
		word: 'joe',
		size: 0.785,
		y: 0.07,
		spread: 12,
		main: solid,
		shadow: shadow(-2, 2),
		cuts: [
			{ box: [0.55, 1, 0, 0.3], fill: K },
			{ box: [0, 0.45, 0.4, 0.62], fill: K, dx: 4 },
			{ box: [0.4, 0.65, 0.75, 1], fill: K },
		],
	},
	9: {
		word: 'joe',
		size: 0.785,
		y: 0.06,
		spread: 11,
		main: solid,
		shadow: shadow(-2, 2),
		cuts: [
			{ box: [0.5, 1, 0, 0.3], fill: K },
			{ box: [0, 0.5, 0.4, 0.62], fill: K, dx: 2 },
			{ box: [0.45, 0.7, 0.75, 1], fill: K },
		],
	},
	10: {
		word: 'joe',
		size: 0.8,
		y: 0.03,
		spread: 8,
		main: { stroke: K },
		shadow: { stroke: W, dx: -2, dy: 2 },
		cuts: [{ box: [0, 0.7, 0, 1], fill: B, dx: 4 }],
	},
	11: { word: 'joe', size: 0.79, y: 0, spread: 8, main: { stroke: K }, shadow: { stroke: B, dx: -4, dy: 3 } },
	12: { word: 'joe', size: 0.7, main: { stroke: G } },
	13: { word: 'joe', size: 0.69, main: { stroke: G } },
	14: { word: 'joe', size: 0.68, main: { stroke: G } },
	15: { word: 'joe', size: 0.67, main: solid, shadow: shadow() },
	16: { word: 'joe', size: 0.5, main: solid, ghost: { fill: B, scale: 1.4, dx: -6 } },
	17: { word: 'joe', size: 0.5, main: solid, shadow: shadow(-1.5, 1) },
	19: { word: 'joe', size: 0.495, main: solid, shadow: shadow(-1.5, 1) },
	20: { word: 'joe', size: 0.49, main: solid, shadow: shadow(-1.5, 1) },
	21: {
		word: 'joe',
		size: 0.5,
		main: { fill: B },
		ghost: { fill: B, scale: 1.1, dx: 8 },
		cuts: [{ box: [0, 1, 0.45, 0.8], fill: W }],
	},
	22: {
		word: 'ben',
		size: 0.92,
		y: 0.03,
		main: solid,
		shadow: shadow(-2, 2),
		cuts: [
			{ box: [0.3, 0.7, 0, 0.6], fill: K, dx: 6 },
			{ box: [0.65, 1, 0.85, 1], fill: K, dx: 4 },
			{ box: [0.4, 0.55, 0.55, 0.68], fill: B, dx: 6 },
		],
	},
	23: {
		word: 'ben',
		size: 0.9,
		y: 0.03,
		main: solid,
		shadow: shadow(-2, 2),
		cuts: [
			{ box: [0.25, 0.75, 0.05, 0.55], fill: K, dx: 8 },
			{ box: [0.6, 1, 0.75, 1], fill: K, dx: 6 },
		],
	},
	24: {
		word: 'ben',
		size: 0.85,
		main: solid,
		shadow: shadow(-2, 2),
		cuts: [
			{ box: [0.15, 0.6, 0, 0.18], fill: B },
			{ box: [0.35, 0.65, 0.05, 0.5], fill: K },
		],
	},
	25: {
		word: 'ben',
		size: 0.82,
		main: solid,
		shadow: shadow(),
		cuts: [
			{ box: [0.2, 0.45, 0, 0.12], fill: K },
			{ box: [0.3, 0.55, 0.3, 0.5], fill: K },
		],
	},
	26: {
		word: 'ben',
		size: 0.81,
		main: { stroke: W },
		cuts: [
			{ box: [0, 0.5, 0.55, 0.7], fill: B },
			{ box: [0.5, 1, 0, 1], fill: B },
		],
	},
	27: {
		word: 'ben',
		size: 0.8,
		main: { stroke: K },
		shadow: { stroke: W, dx: 3 },
		ghost: { stroke: B, scale: 1.15 },
	},
	28: { word: 'ben', size: 0.67, main: { stroke: B, opacity: 0.7 }, shadow: { stroke: K, dx: 2 } },
	29: { word: 'ben', size: 0.66, main: { fill: K } },
	30: { word: 'ben', size: 0.65, main: solid, shadow: shadow() },
	31: { word: 'ben', size: 0.645, main: solid, shadow: shadow() },
	32: {
		band: SCREEN,
		word: 'ben',
		size: 0.45,
		y: 0.005,
		main: { fill: B },
		cuts: [{ box: [0, 0.35, 0, 1], fill: K }],
		bars: [[-0.31, 0.04, -0.15, 0.06]],
	},
	33: {
		band: SCREEN,
		bars: [
			[-0.2, -0.08, -0.02, -0.04],
			[-0.08, -0.03, 0.16, 0.02],
			[-0.31, 0.04, -0.24, 0.06],
		],
	},
	34: { band: { height: 1, rim: 0.002 } },
	36: { band: { height: 0.78, rim: 0.025 } },
	37: { band: { height: 0.73, rim: 0.012 } },
	38: { band: { height: 0.68, rim: 0.005 } },
	39: { band: { height: 0.65, rim: 0.003 } },
	40: { band: { height: 0.6, rim: 0.002 } },
	41: {
		word: 'logo',
		size: 2.1,
		y: 0.03,
		blur: 4,
		main: solid,
		clipToBand: { height: 1.42 },
		cuts: [
			{ box: [0.35, 0.55, 0, 1], fill: B },
			{ box: [0.85, 1, 0, 1], fill: K },
		],
	},
	42: {
		word: 'logo',
		size: 1.25,
		y: 0.1,
		blur: 10,
		main: solid,
		ghost: { fill: B, scale: 1.08, opacity: 0.8 },
		cuts: [{ box: [0.5, 0.6, 0, 1], fill: B }],
	},
	43: {
		word: 'logo',
		size: 0.8,
		y: -0.05,
		blur: 10,
		main: solid,
		ghost: { fill: B, scale: 1.04, dx: -6, dy: 6, opacity: 0.9 },
		shadow: shadow(-10, 10),
	},
	44: { word: 'logo', size: 0.78, y: -0.06, blur: 8, main: solid, ghost: { fill: B, dx: -8, dy: 6 } },
	45: {
		word: 'logo',
		size: 0.72,
		y: -0.04,
		blur: 7,
		main: solid,
		ghost: { fill: B, scale: 1.05, dx: -20, dy: -22, opacity: 0.9 },
		cuts: [{ box: [0.55, 1, 0.75, 1], fill: K }],
	},
	46: {
		word: 'logo',
		size: 0.7,
		y: -0.03,
		blur: 6,
		main: solid,
		shadow: { fill: W, dx: -8, dy: -4, opacity: 0.5 },
		cuts: [
			{ box: [0.55, 0.8, 0, 0.3], fill: K },
			{ box: [0, 0.4, 0.25, 0.5], fill: K },
		],
	},
	47: {
		word: 'logo',
		size: 0.7,
		y: -0.02,
		blur: 3,
		main: solid,
		cuts: [
			{ box: [0, 0.42, 0.05, 0.45], fill: K },
			{ box: [0.55, 0.85, 0, 0.4], fill: K, dx: 6 },
			{ box: [0.6, 0.75, 0.55, 1], fill: K },
		],
	},
	48: {
		word: 'logo',
		size: 0.68,
		main: solid,
		cuts: [
			{ box: [0, 0.4, 0.06, 0.38], fill: K },
			{ box: [0.55, 0.75, 0, 0.18], fill: K },
			{ box: [0.75, 0.9, 0.12, 0.45], fill: K, dx: 4 },
		],
	},
	49: {
		word: 'logo',
		size: 0.65,
		main: solid,
		cuts: [
			{ box: [0, 0.42, 0.02, 1], fill: K },
			{ box: [0.5, 1, 0, 0.04], fill: K },
		],
	},
	50: {
		word: 'logo',
		size: 0.65,
		main: solid,
		cuts: [
			{ box: [0, 0.42, 0.02, 0.92], fill: K },
			{ box: [0.5, 1, 0, 0.03], fill: K },
		],
	},
	51: { word: 'logo', size: INTRO_SETTLE_SIZE, main: solid },
};

export const INTRO_LAST_FRAME = 51;

// Renderer
// ------------
const WORDS: Record<WordKey, Word> = { joe: JOE, ben: BEN, logo: LOGO };
export const CUT_SLOTS = 3;
export const BAR_SLOTS = 3;

const query = <T extends Element>(root: Element, selector: string) => root.querySelector<T>(selector);
const queryAll = <T extends Element>(root: Element, selector: string) => Array.from(root.querySelectorAll<T>(selector));

const applyLook = (el: SVGElement | null, look: Look | undefined, word: Word, strokeWidth: number) => {
	if (!el) return;
	if (!look) {
		el.style.display = 'none';
		return;
	}
	const { fill = 'none', stroke = 'none', dx = 0, dy = 0, scale = 1, opacity = 1 } = look;
	el.style.display = '';
	el.style.fill = fill;
	el.style.stroke = stroke;
	el.style.strokeWidth = String(strokeWidth);
	el.style.opacity = String(opacity);
	el.setAttribute(
		'transform',
		`translate(${word.cx + dx} ${word.cy + dy}) scale(${scale}) translate(${-word.cx} ${-word.cy})`
	);
};

const bandPath = (band: Band, halfWidth: number, stage: number, toUnits: number, grow = 0) => {
	const cx = LOGO_BOX.width / 2;
	const cy = LOGO_BOX.height / 2;
	const x0 = cx - halfWidth * toUnits;
	const x1 = cx + halfWidth * toUnits;
	const { screenAspect, screenCurve } = loaderSettings;
	const outer = band.height / screenAspect / 2;
	const side = (outer - (band.rim ?? 0) + grow) * stage * toUnits;
	const centre = ((outer - (band.rim ?? 0)) * screenCurve + grow) * stage * toUnits;
	// Quadratic control point that puts the curve's midpoint at the centre height
	const control = 2 * centre - side;
	return [
		`M${x0} ${cy - side}`,
		`Q${cx} ${cy - control} ${x1} ${cy - side}`,
		`L${x1} ${cy + side}`,
		`Q${cx} ${cy + control} ${x0} ${cy + side}`,
		'Z',
	].join(' ');
};

export type IntroIds = Record<WordKey | 'band' | 'blur', string>;

const measure = (root: SVGSVGElement) => {
	const markPx = root.getBoundingClientRect().width || 120;
	const stagePx = Math.min(window.innerWidth, window.innerHeight * STAGE_ASPECT, STAGE_MAX) * loaderSettings.scale;
	return { markPx, stagePx, toUnits: LOGO_BOX.width / markPx };
};

// The static mark's logo width, as a stage fraction
export const restingSize = (root: SVGSVGElement) => {
	const { markPx, stagePx } = measure(root);
	return (markPx * LOGO.width) / LOGO_BOX.width / stagePx;
};

export const createIntro = (root: SVGSVGElement, ids: IntroIds) => {
	const scene = query<SVGGElement>(root, '[data-intro]');
	const stageClip = query<SVGGElement>(root, '[data-stage-clip]');
	const stage = query<SVGGElement>(root, '[data-stage]');
	const band = query<SVGPathElement>(root, '[data-band]');
	const rim = query<SVGPathElement>(root, '[data-band-rim]');
	const clipBand = query<SVGPathElement>(root, '[data-clip-band]');
	const blur = query<SVGFEGaussianBlurElement>(root, '[data-blur]');
	const main = query<SVGUseElement>(root, '[data-layer="main"]');
	const shadowLayer = query<SVGUseElement>(root, '[data-layer="shadow"]');
	const ghost = query<SVGUseElement>(root, '[data-layer="ghost"]');
	const cutUses = queryAll<SVGUseElement>(root, '[data-cut]');
	const cutRects = queryAll<SVGRectElement>(root, '[data-cut-rect]');
	const bars = queryAll<SVGRectElement>(root, '[data-bar]');
	const letters = {
		joe: queryAll<SVGPathElement>(root, '[data-letters="joe"] path'),
		ben: queryAll<SVGPathElement>(root, '[data-letters="ben"] path'),
	};

	const renderBand = (frame: Frame, halfWidth: number, stagePx: number, toUnits: number) => {
		if (!band || !rim) return;
		const shape = frame.band;
		band.style.display = shape ? '' : 'none';
		rim.style.display = shape?.rim ? '' : 'none';
		if (!shape) return;
		band.setAttribute('d', bandPath(shape, halfWidth, stagePx, toUnits));
		if (shape.rim) rim.setAttribute('d', bandPath(shape, halfWidth, stagePx, toUnits, shape.rim));
	};

	const renderBars = (frame: Frame, stagePx: number, toUnits: number) => {
		bars.forEach((bar, i) => {
			const rect = frame.bars?.[i];
			bar.style.display = rect ? '' : 'none';
			if (!rect) return;
			const [x0, y0, x1, y1] = rect.map(v => v * stagePx * toUnits);
			bar.setAttribute('x', String(LOGO_BOX.width / 2 + x0));
			bar.setAttribute('y', String(LOGO_BOX.height / 2 + y0));
			bar.setAttribute('width', String(x1 - x0));
			bar.setAttribute('height', String(y1 - y0));
		});
	};

	const renderSpread = (key: WordKey, spread = 0) => {
		if (key === 'logo') return;
		letters[key].forEach((path, i) => {
			path.setAttribute('transform', `translate(${(i - 1) * spread} 0)`);
		});
	};

	const renderCuts = (frame: Frame, word: Word, href: string, strokeWidth: number) => {
		const top = word.cy - word.height / 2;
		const left = word.cx - word.width / 2;
		cutUses.forEach((use, i) => {
			const cut = frame.cuts?.[i];
			const rect = cutRects[i];
			use.setAttribute('href', href);
			applyLook(use, cut, word, strokeWidth);
			if (!cut || !rect) return;
			const [y0, y1, x0 = 0, x1 = 1] = cut.box;
			rect.setAttribute('x', String(left + x0 * word.width));
			rect.setAttribute('y', String(top + y0 * word.height));
			rect.setAttribute('width', String((x1 - x0) * word.width));
			rect.setAttribute('height', String((y1 - y0) * word.height));
		});
	};

	const render = (frame: Frame) => {
		if (!scene || !stage || !stageClip) return;
		// NOTE • Measured every frame so a resize mid-intro stays correct
		const { toUnits, stagePx } = measure(root);
		// NOTE • The band is a curved ultrawide screen, not a full-bleed wipe — the
		// video's frame-wide band shrunk (width and height alike) to the landed logo's width
		const bandStage = INTRO_SETTLE_SIZE * loaderSettings.bandWidth * stagePx;
		const halfWidth = bandStage / 2;

		renderBand(frame, halfWidth, bandStage, toUnits);
		renderBars(frame, stagePx, toUnits);

		if (frame.clipToBand && clipBand) {
			clipBand.setAttribute('d', bandPath(frame.clipToBand, halfWidth, bandStage, toUnits));
			stageClip.setAttribute('clip-path', `url(#${ids.band})`);
		} else stageClip.removeAttribute('clip-path');

		if (!frame.word) {
			stage.style.display = 'none';
			return;
		}
		const word = WORDS[frame.word];
		const href = `#${ids[frame.word]}`;
		const landing = frame.word === 'logo' ? restingSize(root) / INTRO_SETTLE_SIZE : 1;
		const scale = ((frame.size ?? 1) * landing * stagePx * toUnits) / word.width;
		const y = (frame.y ?? 0) * stagePx * toUnits;
		const strokeWidth = STROKE_PX;

		stage.style.display = '';
		stage.setAttribute(
			'transform',
			`translate(${LOGO_BOX.width / 2} ${LOGO_BOX.height / 2 + y}) scale(${scale}) translate(${-word.cx} ${-word.cy})`
		);

		const blurPx = (frame.blur ?? 0) * landing;
		if (blur && blurPx) {
			// Horizontal smear only — the source reads as motion blur on a fast push
			const unitPx = scale / toUnits;
			blur.setAttribute('stdDeviation', `${blurPx / unitPx} ${blurPx / unitPx / 6}`);
			stage.setAttribute('filter', `url(#${ids.blur})`);
		} else stage.removeAttribute('filter');

		renderSpread(frame.word, frame.spread);
		for (const use of [main, shadowLayer, ghost]) use?.setAttribute('href', href);
		applyLook(main, frame.main, word, strokeWidth);
		applyLook(shadowLayer, frame.shadow, word, strokeWidth);
		applyLook(ghost, frame.ghost, word, strokeWidth);
		renderCuts(frame, word, href, strokeWidth);
	};

	return render;
};
