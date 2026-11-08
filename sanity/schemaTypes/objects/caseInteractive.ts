// Interactive Case Blocks
// ------------
// NOTE • Full-width case builder blocks visitors drive themselves: a parallax
// slideshow (up to 6 images) with thumbnails, and a before/after split slider. Rendered by
// src/components/ParallaxGallery and src/components/BeforeAfter, both from
// Osmo resources. Each takes one of a few fixed shapes, picked by the editor.

// Imports
// ------------
import { ImagesIcon } from '@sanity/icons/Images';
import { SplitVerticalIcon } from '@sanity/icons/SplitVertical';
import { type ArrayRule, defineArrayMember, defineField, defineType, type ImageRule } from 'sanity';
import { createGalleryImagesInput } from '../../components/GalleryImagesInput';
import { WithValidationNotice } from '../../components/ValidationNotice';
import { MAX_PARALLAX_IMAGES as MAX_SLIDES, MIN_PARALLAX_IMAGES as MIN_SLIDES } from '../../lib/galleryLimits';

// Constants
// ------------
// NOTE • Values are width:height; the site turns them into an aspect ratio (src/data/content.ts)
export const BLOCK_ASPECTS = [
	{ title: 'Landscape 16:10', value: '16:10' },
	{ title: 'Landscape 4:3', value: '4:3' },
	{ title: 'Portrait 3:4', value: '3:4' },
];
const DEFAULT_ASPECT = '16:10';
// NOTE • These blocks are up to 894px wide, so about 1800px on a retina screen;
// anything narrower is stretched and looks soft
const MIN_IMAGE_WIDTH = 1800;
const IMAGE_SIZE_HINT = 'Upload images around 2000px wide (at least 1800px) so they stay sharp on large screens.';

// Helpers
// ------------
// NOTE • An image ref spells out its size (image-<id>-<width>x<height>-<ext>), so no fetch is needed
type ImageValue = { asset?: { _ref?: string }; alt?: string };
const widthOf = (image: ImageValue | undefined) => Number(image?.asset?._ref?.split('-').at(-2)?.split('x')[0]) || 0;
const isSoft = (image: ImageValue | undefined) => {
	const width = widthOf(image);
	return width > 0 && width < MIN_IMAGE_WIDTH;
};

// One image field: warns when its file is too narrow
const sharpEnough = (rule: ImageRule) =>
	rule
		.custom((value: ImageValue | undefined) =>
			isSoft(value)
				? `This image is only ${widthOf(value)}px wide, so it will look soft. ${IMAGE_SIZE_HINT}`
				: true
		)
		.warning();

// NOTE • A gallery's warning sits on the list, not each tile — Sanity's grid shows a
// tile's warning as an icon with no text — and names the images by their alt text
const allSharpEnough = (rule: ArrayRule<ImageValue[]>) =>
	rule
		.custom((images: ImageValue[] | undefined) => {
			const soft = (images ?? [])
				.map((image, index) => ({ image, position: index + 1 }))
				.filter(({ image }) => isSoft(image));
			if (!soft.length) return true;
			const names = soft.map(
				({ image, position }) => `${image.alt || `Image ${position}`} (${widthOf(image)}px)`
			);
			return `${soft.length === 1 ? '1 image is' : `${soft.length} images are`} too small and will look soft: ${names.join(', ')}. ${IMAGE_SIZE_HINT}`;
		})
		.warning();

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
		'A full-width slideshow: each image wipes in over the last with a parallax slide. It plays by itself until a visitor takes over; thumbnails below on desktop.',
	fields: [
		aspectField(),
		defineField({
			name: 'images',
			title: 'Images',
			type: 'array',
			description: `Add ${MIN_SLIDES}–${MAX_SLIDES} images, in order — upload or pick several at once, then drag to reorder. ${IMAGE_SIZE_HINT}`,
			of: [defineArrayMember({ type: 'image', options: { hotspot: true }, fields: [altField()] })],
			options: { layout: 'grid' },
			components: { input: createGalleryImagesInput(MAX_SLIDES) },
			validation: rule => [
				rule
					.required()
					.min(MIN_SLIDES)
					.max(MAX_SLIDES)
					.error(`Add between ${MIN_SLIDES} and ${MAX_SLIDES} images.`),
				allSharpEnough(rule),
			],
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
			description: `Shown on the left of the handle. ${IMAGE_SIZE_HINT}`,
			options: { hotspot: true },
			fields: [altField()],
			components: { input: WithValidationNotice },
			validation: rule => [rule.required(), sharpEnough(rule)],
		}),
		defineField({
			name: 'after',
			title: 'After',
			type: 'image',
			description: `Shown on the right of the handle. ${IMAGE_SIZE_HINT}`,
			options: { hotspot: true },
			fields: [altField()],
			components: { input: WithValidationNotice },
			validation: rule => [rule.required(), sharpEnough(rule)],
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
