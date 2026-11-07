// Interactive Case Blocks
// ------------
// NOTE • Full-width case builder blocks visitors drive themselves: a parallax
// slideshow with thumbnails, and a before/after split slider. Rendered by
// src/components/ParallaxGallery and src/components/BeforeAfter, both from
// Osmo resources. Each takes one of a few fixed shapes, picked by the editor.

// Imports
// ------------
import { ImagesIcon } from '@sanity/icons/Images';
import { SplitVerticalIcon } from '@sanity/icons/SplitVertical';
import { defineArrayMember, defineField, defineType } from 'sanity';
import { createGalleryImagesInput } from '../../components/GalleryImagesInput';

// Constants
// ------------
// NOTE • Values are width:height; the site turns them into an aspect ratio (src/data/content.ts)
export const BLOCK_ASPECTS = [
	{ title: 'Landscape 16:10', value: '16:10' },
	{ title: 'Landscape 4:3', value: '4:3' },
	{ title: 'Portrait 3:4', value: '3:4' },
];
const DEFAULT_ASPECT = '16:10';
const MIN_SLIDES = 2;
const MAX_SLIDES = 12;

// Helpers
// ------------
const aspectField = () =>
	defineField({
		name: 'aspect',
		title: 'Shape',
		type: 'string',
		description: 'Every image is cropped to this shape — set each one’s hotspot to keep its subject in frame.',
		initialValue: DEFAULT_ASPECT,
		options: { list: BLOCK_ASPECTS, layout: 'dropdown' },
		validation: rule => rule.required(),
	});

const altField = () =>
	defineField({
		name: 'alt',
		title: 'Alternative text',
		type: 'string',
		description: 'Describe what the image shows, for screen readers and search engines.',
		validation: rule => rule.required(),
	});

// Exports
// ------------
export const caseParallaxGallery = defineType({
	name: 'caseParallaxGallery',
	title: 'Parallax gallery',
	type: 'object',
	icon: ImagesIcon,
	description:
		'A full-width slideshow: each image wipes in over the last with a parallax slide. Thumbnails below on desktop; it plays by itself on phones until swiped.',
	fields: [
		aspectField(),
		defineField({
			name: 'images',
			title: 'Images',
			type: 'array',
			description: `Add ${MIN_SLIDES}–${MAX_SLIDES} images, in order — upload or pick several at once, then drag to reorder.`,
			of: [defineArrayMember({ type: 'image', options: { hotspot: true }, fields: [altField()] })],
			options: { layout: 'grid' },
			components: { input: createGalleryImagesInput(MAX_SLIDES) },
			validation: rule =>
				rule
					.required()
					.min(MIN_SLIDES)
					.max(MAX_SLIDES)
					.error(`Add between ${MIN_SLIDES} and ${MAX_SLIDES} images.`),
		}),
	],
	preview: {
		select: { aspect: 'aspect', first: 'images.0', second: 'images.1', third: 'images.2' },
		prepare: ({ aspect, first, second, third }) => {
			const count = [first, second, third].filter(Boolean).length;
			return {
				title: 'Parallax gallery',
				subtitle: `${aspect ?? DEFAULT_ASPECT} · ${count === 3 ? '3+' : count} image${count === 1 ? '' : 's'}`,
				media: first ?? ImagesIcon,
			};
		},
	},
});

export const caseBeforeAfter = defineType({
	name: 'caseBeforeAfter',
	title: 'Before / after',
	type: 'object',
	icon: SplitVerticalIcon,
	description: 'Two images on top of each other, with a handle visitors drag to reveal one over the other.',
	fields: [
		aspectField(),
		defineField({
			name: 'before',
			title: 'Before',
			type: 'image',
			description: 'Shown on the left of the handle.',
			options: { hotspot: true },
			fields: [altField()],
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'after',
			title: 'After',
			type: 'image',
			description: 'Shown on the right of the handle.',
			options: { hotspot: true },
			fields: [altField()],
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'start',
			title: 'Handle starts at',
			type: 'number',
			description: 'Percent from the left edge, 0–100.',
			initialValue: 50,
			validation: rule => rule.required().min(0).max(100),
		}),
	],
	preview: {
		select: { before: 'before', after: 'after', beforeAlt: 'before.alt', afterAlt: 'after.alt' },
		prepare: ({ before, after, beforeAlt, afterAlt }) => ({
			title: [beforeAlt, afterAlt].filter(Boolean).join('  →  ') || 'Before / after',
			subtitle: 'Before / after',
			media: after ?? before ?? SplitVerticalIcon,
		}),
	},
});
