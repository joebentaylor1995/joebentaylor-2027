// Imports
// ------------
import { stegaClean } from 'next-sanity';

// Types
// ------------
export interface StegaParts {
	/** The visible text, safe to split into words, letters or lines */
	clean: string;
	/** The invisible Visual Editing payload ('' outside draft mode) */
	encoded: string;
}

// Exports
// ------------
/**
 * Separates a string's stega payload (Visual Editing's invisible characters)
 * from its visible text.
 *
 * Animations that split text into words or letters would otherwise chop the
 * payload into fragments the overlays can't decode — Sanity logs a “Failed to
 * decode stega” error for every piece. Split `clean`, then render `encoded` as
 * one text node inside the element marked `data-sanity-edit-target`, so the
 * whole element stays click-to-edit. Outside draft mode `encoded` is empty.
 */
export const splitStega = (value: string): StegaParts => {
	const clean = stegaClean(value);
	const payloadLength = value.length - clean.length;
	if (!payloadLength) return { clean, encoded: '' };

	// NOTE • stegaClean removes one contiguous run; find where it starts
	let start = 0;
	while (start < clean.length && value[start] === clean[start]) start++;
	return { clean, encoded: value.slice(start, start + payloadLength) };
};
