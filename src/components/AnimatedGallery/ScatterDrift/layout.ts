// Scatter Drift layout
// ------------
// NOTE • Pure maths for the Scatter Drift animation, kept apart from the
// component so the motion can be tuned in one place. Three lanes of 4:3
// cards: the centre lane rises while the side lanes fall, and every step each
// card glides into the next slot of its lane. Slots — not cards — own the
// composed offsets and tilts, so the scene settles into the same arrangement
// after every step and the loop reads as one continuous motion.
//
// Sizes and vertical distances are fractions of the stage height; lane
// centres are fractions of its width, so the side lanes always bleed off the edges.

// Imports
// ------------
import type { GalleryImage } from '@/data/projects';
import { at, fillCards, wrap } from '../utils';

// Types
// ------------
interface Lane {
	// Centre of the lane, as a fraction of the stage width
	x: number;
	// -1 rises, 1 falls
	direction: -1 | 1;
	// Distance between slots, as a fraction of the stage height
	spacing: number;
	// Shifts the lane's slots off the centre line, in slots
	offset: number;
	// Which image the lane starts on, so neighbouring cards differ
	shift: number;
	// Each card's own lean, in degrees — side lanes stand almost upright
	leans: readonly number[];
	// Per-slot sideways swing (fraction of the stage height) and twist (degrees)
	swings: readonly number[];
	twists: readonly number[];
}

export interface Card {
	key: string;
	image: GalleryImage;
	lane: number;
	slot: number;
	isHero: boolean;
	lean: number;
}

export interface Frame {
	x: number;
	y: number;
	rotation: number;
	isVisible: boolean;
}

// Constants
// ------------
// NOTE • Measured from the reference loop: one card per second, no rest — a
// slow lift-off, a peak a fifth of the way in, then a long glide. Rotation runs
// on its own curve that leans back first (the negative y1) and trails position
export const TIMING = {
	step: 1.05,
	position: [0.4, 0, 0, 1.08],
	rotation: [0.42, -0.4, 0.04, 0.98],
} as const;
export const CARD_ASPECT = 4 / 3;
// Card width, as a fraction of the stage height
export const CARD_WIDTH = 0.48;

const CARD_HEIGHT = CARD_WIDTH / CARD_ASPECT;
// Half the card's diagonal — the furthest a rotated corner can reach
const CARD_REACH = Math.hypot(CARD_WIDTH, CARD_HEIGHT) / 2;

// NOTE • Side lanes are drawn first, so the centre lane passes over them
const LANES: Lane[] = [
	{
		x: 0.07,
		direction: 1,
		spacing: 0.52,
		offset: 0.3,
		shift: 2,
		leans: [-82, -9, -76, -88, -14, -71, -84, -5, -79],
		swings: [0, 0.03, -0.02, 0.02, -0.03, 0.01, -0.01, 0.03, -0.02],
		twists: [0, 3, -2, 4, -3, 2, -4, 1, -1],
	},
	{
		x: 0.95,
		direction: 1,
		spacing: 0.56,
		offset: -0.15,
		shift: 4,
		leans: [-17, 79, -11, 86, -23, 73, -8, 82, -19],
		swings: [0.02, -0.03, 0.01, -0.02, 0.03, -0.01, 0.02, -0.03, 0],
		twists: [-2, 3, -1, 4, -3, 2, -4, 1, 0],
	},
	{
		x: 0.5,
		direction: -1,
		spacing: 0.4,
		offset: 0,
		shift: 0,
		leans: [-3, 2, -2, 4, -4, 1, -1, 3, -2],
		swings: [-0.07, 0.06, -0.04, 0.08, -0.06, 0.04, -0.08, 0.05, -0.03],
		twists: [7, -12, 5, -9, 10, -6, 8, -11, 4],
	},
];
const HERO_LANE = LANES.length - 1;

// Helpers
// ------------
const lerp = (from: number, to: number, amount: number) => from + (to - from) * amount;

// NOTE • A slot's value between two slots, for a card part-way along its lane
const between = (values: readonly number[], count: number, position: number) => {
	const slot = Math.floor(position);
	return lerp(at(values, slot % count), at(values, (slot + 1) % count), position - slot);
};

// Exports
// ------------
export const buildCards = (images: GalleryImage[]): Card[] => {
	const pool = fillCards(images);
	return LANES.flatMap((lane, laneIndex) =>
		pool.map((_, slot) => ({
			key: `${laneIndex}-${slot}`,
			image: at(pool, slot + lane.shift),
			lane: laneIndex,
			slot,
			isHero: laneIndex === HERO_LANE,
			lean: at(lane.leans, slot),
		}))
	);
};

// NOTE • Progress counts steps (1 = every card one slot along); position and
// rotation each have their own, so tilt can trail the move
export const frameFor = (
	card: Card,
	count: number,
	progress: { position: number; rotation: number },
	stage: { width: number; height: number }
): Frame => {
	const lane = LANES[card.lane] as Lane;
	const slot = wrap(card.slot + lane.offset + lane.direction * progress.position, count);
	const turned = card.slot + lane.offset + lane.direction * progress.rotation;
	const unit = stage.height;
	const y = stage.height / 2 + slot * lane.spacing * unit;
	const x = lane.x * stage.width + between(lane.swings, count, slot) * unit;
	return {
		x: x - (CARD_WIDTH * unit) / 2,
		y: y - (CARD_HEIGHT * unit) / 2,
		rotation: card.lean + between(lane.twists, count, turned),
		isVisible: y + CARD_REACH * unit > 0 && y - CARD_REACH * unit < stage.height,
	};
};
