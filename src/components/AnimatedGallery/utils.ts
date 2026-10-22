// Gallery utilities
// ------------
// NOTE • Shared by every gallery animation

// Imports
// ------------
import type { CSSProperties } from 'react';
import type { GalleryImage } from '@/data/projects';

// Exports
// ------------
export const MIN_CARDS = 6;

export const at = <T>(list: readonly T[], index: number) =>
	list[((index % list.length) + list.length) % list.length] as T;

// NOTE • Fewer images than slots would show the same card twice on screen
export const fillCards = (images: GalleryImage[]) =>
	Array.from({ length: Math.max(MIN_CARDS, images.length) }, (_, index) => at(images, index));

// NOTE • Wraps a slot into [-length / 2, length / 2), so cards loop round off-stage
export const wrap = (value: number, length: number) =>
	((((value + length / 2) % length) + length) % length) - length / 2;

// NOTE • CSS cubic-bezier, solved for y at time t by bisection — accurate and cheap enough per frame
export const cubicBezier =
	([x1, y1, x2, y2]: readonly number[]) =>
	(t: number) => {
		const curve = (a: number, b: number, u: number) => 3 * (1 - u) ** 2 * u * a + 3 * (1 - u) * u * u * b + u ** 3;
		let low = 0;
		let high = 1;
		let u = t;
		for (let i = 0; i < 20; i++) {
			u = (low + high) / 2;
			if (curve(x1 as number, x2 as number, u) < t) low = u;
			else high = u;
		}
		return curve(y1 as number, y2 as number, u);
	};

// NOTE • Cards are cropped to a fixed shape — the Sanity hotspot decides what stays in frame
export const focusOf = ({ hotspot }: GalleryImage) =>
	hotspot ? ({ '--focus': `${hotspot.x * 100}% ${hotspot.y * 100}%` } as CSSProperties) : undefined;
