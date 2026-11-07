// Scatter Drift layout
// ------------
// NOTE • Pure maths for the Scatter Drift animation, kept apart from the
// component so the motion can be tuned in one place. One 4:3 card rests in the
// centre; then it rises off the top while the next comes up from below, as if
// both rode the rim of a wheel: a card's tilt is tied to its height, so the
// arriving card enters nearly sideways and unwinds upright as it reaches the
// centre, and the leaving one keeps turning the same way as it climbs out.
//
// Every card runs the same two-step life — enter, then rest and leave — offset
// by one step per card, so the loop never shows a seam. Vertical distances are
// fractions of the stage height; the card is sized off the stage width.

// Imports
// ------------
import type { GalleryImage } from '@/data/projects';
import { at, cubicBezier, fillCards } from '../utils';

// Types
// ------------
export interface Card {
	key: string;
	image: GalleryImage;
	slot: number;
}

export interface Frame {
	y: number;
	rotation: number;
	isVisible: boolean;
}

// One vertical move: when it runs (seconds into its step), where it starts and ends, and its easing
interface Move {
	start: number;
	end: number;
	from: number;
	to: number;
	ease: (t: number) => number;
}

// Constants
// ------------
// NOTE • Fitted to the reference loop, frame by frame (2.4s a card). Measured
// across both cards, the tilt is -108° per stage height of offset, to within
// half a degree. The arriving card is already rising before the first has gone
// far and settles without overshoot; the leaving one builds speed, then slows
// as it clears the top edge.
export const STEP = 2.4;
export const CARD_ASPECT = 4 / 3;
// Card width, as a fraction of the stage width
export const CARD_WIDTH = 0.66;
// Degrees of tilt per stage height of vertical offset (clockwise above centre)
const TILT = 108;

const ENTER: Move = { start: 0.25, end: 1.59, from: 0.83, to: 0, ease: cubicBezier([0.35, 0.2, 0, 0.95]) };
// NOTE • Measured, the card stops at -0.77 with a corner on the edge; -0.8 makes sure it clears
const LEAVE: Move = { start: 0.07, end: 1.06, from: 0, to: -0.8, ease: cubicBezier([0.61, 0.04, 0.19, 0.8]) };

// The card's half-size in stage heights, for a 3:4 stage
const STAGE_ASPECT = 3 / 4;
const HALF_WIDTH = (CARD_WIDTH * STAGE_ASPECT) / 2;
const HALF_HEIGHT = HALF_WIDTH / CARD_ASPECT;

// Helpers
// ------------
// NOTE • Clamped, so a move holds its start before it runs and its end after
const valueAt = (move: Move, time: number) => {
	const t = Math.min(1, Math.max(0, (time - move.start) / (move.end - move.start)));
	return move.from + (move.to - move.from) * move.ease(t);
};

// How far the turned card reaches above and below its centre
const halfExtent = (degrees: number) => {
	const radians = (degrees * Math.PI) / 180;
	return HALF_WIDTH * Math.abs(Math.sin(radians)) + HALF_HEIGHT * Math.abs(Math.cos(radians));
};

// Exports
// ------------
export const buildCards = (images: GalleryImage[]): Card[] =>
	fillCards(images).map((_, slot, pool) => ({ key: `${slot}`, image: at(pool, slot), slot }));

// NOTE • A card's life starts one step before it reaches the centre: its first
// step is the entrance, its second the rest and exit; after that it waits
// off the top until its turn comes round again. Slot 0 starts at rest.
export const frameFor = (card: Card, count: number, elapsed: number): Frame => {
	const cycle = count * STEP;
	const life = (((elapsed - (card.slot - 1) * STEP) % cycle) + cycle) % cycle;
	const y = life < STEP ? valueAt(ENTER, life) : valueAt(LEAVE, life - STEP);
	const rotation = -TILT * y;
	return { y, rotation, isVisible: Math.abs(y) - halfExtent(rotation) < 0.5 };
};
