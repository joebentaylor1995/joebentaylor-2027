// Case Study Builder Blocks
// ------------
// NOTE • Each block maps 1:1 to a layout in src/components/ProjectCaseBuilder.
// Add a new layout by defining a block here, registering it in
// project.caseBuilder, and projecting it in the project query.

// Imports
// ------------
import { BlockElementIcon } from '@sanity/icons/BlockElement';
import { SplitHorizontalIcon } from '@sanity/icons/SplitHorizontal';
import { defineArrayMember, defineField, defineType } from 'sanity';
import { KIND_LABELS, previewMedia } from './mediaItem';

// Exports
// ------------
// NOTE • Insert-menu grid thumbnails: animated SVG skeletons (grey boxes
// playing each block's reveal or gallery motion), served from
// public/images/studio by the Next app hosting the Studio. A new block needs
// its own <name>.svg.
// NOTE • How the gallery is named when picked as one side of a Two up
const SCATTER_DRIFT_TITLE = 'Scatter Drift animation';

export const insertPreviewUrl = (schemaTypeName: string) => `/images/studio/${schemaTypeName}.svg`;

export const caseSingle = defineType({
	name: 'caseSingle',
	title: 'Full width',
	type: 'object',
	icon: BlockElementIcon,
	fields: [defineField({ name: 'media', title: 'Media', type: 'mediaItem', validation: rule => rule.required() })],
	preview: {
		select: {
			alt: 'media.alt',
			kind: 'media.kind',
			image: 'media.image',
			poster: 'media.poster',
			youtube: 'media.youtube',
		},
		prepare: ({ alt, kind, image, poster, youtube }) => ({
			title: alt || 'Full width',
			subtitle: `Full width · ${(KIND_LABELS[kind as keyof typeof KIND_LABELS] ?? KIND_LABELS.image).toLowerCase()}`,
			media: previewMedia({ kind, image, poster, youtube }),
		}),
	},
});

export const caseDual = defineType({
	name: 'caseDual',
	title: 'Two up',
	type: 'object',
	icon: SplitHorizontalIcon,
	fields: [
		defineField({
			name: 'media',
			title: 'Media (left, right)',
			type: 'array',
			description: 'Each side is an image, a video loop, a YouTube link, or the Scatter Drift animation.',
			// NOTE • Scatter Drift only lives here: on its own it read as too sparse for a full-width block
			of: [
				defineArrayMember({ type: 'mediaItem' }),
				defineArrayMember({ type: 'caseGalleryScatterDrift', title: SCATTER_DRIFT_TITLE }),
			],
			validation: rule => rule.required().length(2).error('A two-up block needs exactly two items.'),
		}),
	],
	preview: {
		select: {
			leftType: 'media.0._type',
			rightType: 'media.1._type',
			left: 'media.0.alt',
			right: 'media.1.alt',
			kind: 'media.0.kind',
			image: 'media.0.image',
			poster: 'media.0.poster',
			youtube: 'media.0.youtube',
			galleryImage: 'media.0.images.0',
		},
		prepare: ({ leftType, rightType, left, right, kind, image, poster, youtube, galleryImage }) => {
			const label = (type: string | undefined, alt: string | undefined) =>
				type === 'caseGalleryScatterDrift' ? SCATTER_DRIFT_TITLE : alt;
			return {
				title: [label(leftType, left), label(rightType, right)].filter(Boolean).join('  ·  ') || 'Two up',
				subtitle: 'Two up',
				media:
					leftType === 'caseGalleryScatterDrift'
						? galleryImage
						: previewMedia({ kind, image, poster, youtube }),
			};
		},
	},
});
