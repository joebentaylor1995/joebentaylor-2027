// Scatter Drift → Two up
// ------------
// NOTE • One-off: Scatter Drift is no longer a block of its own, only one side
// of a Two up. Each standalone Scatter Drift block becomes a Two up in the same
// place (same key): the gallery on the left, and — so the block stays valid and
// keeps showing on the site — its first image on the right as a stand-in for
// the editor to swap for the real image or video.
// Run after the site and Studio that understand galleries in Two up are deployed:
// bunx sanity migration run scatter-drift-to-two-up (dry run), then add --no-dry-run

// Imports
// ------------
import { at, defineMigration, set } from 'sanity/migrate';

// Types
// ------------
interface GalleryImage {
	_key: string;
	_type: 'image';
	asset?: { _ref: string; _type: 'reference' };
	hotspot?: unknown;
	crop?: unknown;
	alt?: string;
}

interface Block {
	_key: string;
	_type: string;
	images?: GalleryImage[];
	background?: unknown;
}

// Helpers
// ------------
const toTwoUp = (block: Block) => {
	const first = block.images?.find(image => image.asset);
	const { _key, ...gallery } = block;
	return {
		_key,
		_type: 'caseDual',
		media: [
			{ ...gallery, _key: `${_key}-gallery` },
			{
				_key: `${_key}-image`,
				_type: 'mediaItem',
				kind: 'image',
				image: first
					? { _type: 'image', asset: first.asset, hotspot: first.hotspot, crop: first.crop }
					: undefined,
				alt: first?.alt ?? '',
			},
		],
	};
};

// Exports
// ------------
export default defineMigration({
	title: 'Move standalone Scatter Drift blocks into Two up',
	documentTypes: ['project'],
	filter: 'count(caseBuilder[_type == "caseGalleryScatterDrift"]) > 0',
	migrate: {
		document(doc) {
			const blocks = (doc.caseBuilder ?? []) as Block[];
			const next = blocks.map(block => (block._type === 'caseGalleryScatterDrift' ? toTwoUp(block) : block));
			return [at('caseBuilder', set(next))];
		},
	},
});
