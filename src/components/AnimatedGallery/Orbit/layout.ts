// Orbit layout
// ------------
// NOTE • Pure maths for the Orbit animation. Square cards sit evenly round a
// circle, upright, and the whole ring makes one eased revolution per loop —
// nearly still at the seam, fastest halfway round. Each card keeps its own
// layer, so where neighbours overlap the overlap travels round with them.
// Measured from the reference loop; sizes are fractions of the stage width.

// Imports
// ------------
import type { GalleryImage } from '@/data/projects';
import { at, fillCards } from '../utils';

// Types
// ------------
export interface Card {
	key: string;
	image: GalleryImage;
	slot: number;
	// Degrees clockwise from 12 o'clock, at rest
	angle: number;
}

// Constants
// ------------
// NOTE • One revolution every 8s on a symmetric ease (1.25° rms from the reference)
export const TIMING = { loop: 8, spin: [0.52, 0, 0.5, 1] } as const;
export const CARD_ASPECT = 1;
// Card width, as a fraction of the stage width
export const CARD_WIDTH = 0.222;
// NOTE • The reference's 8 cards overlap their neighbours by about 8% — the ring
// radius scales with the card count so 6 or 9 cards overlap the same way
const NEIGHBOUR_OVERLAP = 0.918;

// Exports
// ------------
export const buildCards = (images: GalleryImage[]): Card[] => {
	const pool = fillCards(images);
	return pool.map((_, slot) => ({
		key: `${slot}`,
		image: at(pool, slot),
		slot,
		angle: (slot * 360) / pool.length,
	}));
};

// NOTE • Fraction of the stage width from the ring's centre to each card's centre
export const radiusFor = (count: number) => (NEIGHBOUR_OVERLAP * CARD_WIDTH) / (2 * Math.sin(Math.PI / count));
