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

// Exports
// ------------
export const caseSingle = defineType({
	name: 'caseSingle',
	title: 'Full width',
	type: 'object',
	icon: BlockElementIcon,
	fields: [defineField({ name: 'media', title: 'Media', type: 'mediaItem', validation: rule => rule.required() })],
	preview: {
		select: { alt: 'media.alt', kind: 'media.kind', image: 'media.image', poster: 'media.poster' },
		prepare: ({ alt, kind, image, poster }) => ({
			title: alt || 'Full width',
			subtitle: `Full width · ${kind === 'video' ? 'video' : 'image'}`,
			media: kind === 'video' ? poster : image,
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
		select: { left: 'media.0.alt', right: 'media.1.alt', image: 'media.0.image', poster: 'media.0.poster' },
		prepare: ({ left, right, image, poster }) => ({
			title: [left, right].filter(Boolean).join('  ·  ') || 'Two up',
			subtitle: 'Two up',
			media: image || poster,
		}),
	},
});
