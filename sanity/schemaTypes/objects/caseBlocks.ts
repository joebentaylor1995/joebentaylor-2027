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
// NOTE • Insert-menu grid thumbnails, served from public/images/studio by the
// Next app hosting the Studio — add a block's name here once it has one
const BLOCKS_WITH_THUMBNAILS = ['caseModel', 'caseGalleryScatterDrift', 'caseGalleryPanorama', 'caseGalleryOrbit'];
export const insertPreviewUrl = (schemaTypeName: string) =>
	BLOCKS_WITH_THUMBNAILS.includes(schemaTypeName) ? `/images/studio/${schemaTypeName}.webp` : undefined;

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
			of: [defineArrayMember({ type: 'mediaItem' })],
			validation: rule => rule.required().length(2).error('A two-up block needs exactly two items.'),
		}),
	],
	preview: {
		select: {
			left: 'media.0.alt',
			right: 'media.1.alt',
			kind: 'media.0.kind',
			image: 'media.0.image',
			poster: 'media.0.poster',
			youtube: 'media.0.youtube',
		},
		prepare: ({ left, right, kind, image, poster, youtube }) => ({
			title: [left, right].filter(Boolean).join('  ·  ') || 'Two up',
			subtitle: 'Two up',
			media: previewMedia({ kind, image, poster, youtube }),
		}),
	},
});
