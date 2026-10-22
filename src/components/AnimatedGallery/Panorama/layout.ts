// Panorama layout
// ------------
// NOTE • Pure maths for the Panorama animation. The cards stand on a ring
// around the camera, all facing it, so turning the ring pans the view: the
// current card swings away to the left, growing as its near edge sweeps past,
// and the next one swings in from the right before gliding to rest. With the
// perspective set to the stage width, a 64° gap shows one card at a time with
// a brief overlap mid-turn — measured from the reference loop.
//
// Inside each card the image sits a little behind the surface, like a view
// through a window: as the card turns, the image slides toward its outer
// side, up to PARALLAX of the card width, and eases back as it settles.

// Imports
// ------------
import type { GalleryImage } from '@/data/projects';
import { at, fillCards, wrap } from '../utils';

// Types
// ------------
export interface Card {
	key: string;
	image: GalleryImage;
	slot: number;
}

// Constants
// ------------
// NOTE • A rest, then a 2s turn: slow lift-off, a peak a third of the way in, a long glide
export const TIMING = { step: 2.5, move: 1.97, turn: [0.48, 0, 0, 1.04] } as const;
export const CARD_ASPECT = 3 / 4;
// Card width, as a fraction of the stage width
export const CARD_WIDTH = 0.64;
// Degrees between neighbouring cards on the ring
export const CARD_GAP = 64;
// NOTE • Measured: the slide follows tanh(turn ÷ 7°), topping out at 3.3% of the card width
export const PARALLAX = { reach: 3.3, softness: 7 } as const;
// The image's overscan, so its edges never show mid-slide
export const PARALLAX_SCALE = 1 + (2 * PARALLAX.reach + 0.4) / 100;

const DEGREES = 180 / Math.PI;
// NOTE • With perspective = stage width, the stage edge sits atan(½) off-axis
// and a card spans atan(width ÷ 2) either side of its centre
const VISIBLE_ANGLE = (Math.atan(0.5) + Math.atan(CARD_WIDTH / 2)) * DEGREES;

// Exports
// ------------
export const buildCards = (images: GalleryImage[]): Card[] =>
	fillCards(images).map((_, slot, pool) => ({ key: `${slot}`, image: at(pool, slot), slot }));

// NOTE • Positive angles sit to the right; progress counts whole turns
export const angleFor = (card: Card, count: number, progress: number) => wrap(card.slot - progress, count) * CARD_GAP;

export const isOnStage = (angle: number) => Math.abs(angle) < VISIBLE_ANGLE;

// NOTE • Percent of the card width; positive slides right, toward a right-hand card's outer edge
export const slideFor = (angle: number) => PARALLAX.reach * Math.tanh(angle / PARALLAX.softness);
