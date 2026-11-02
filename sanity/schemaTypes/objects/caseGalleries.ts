// Animated Gallery Blocks
// ------------
// NOTE • Code-driven alternatives to a video loop: editors upload stills and
// the site animates them, so a case study ships a few images instead of a
// heavy video. Each animation is its own "Animated Gallery — …" block in the
// builder's insert menu, rendered by src/components/AnimatedGallery. To add
// one, define it with `defineGallery` below, register it in schemaTypes and
// project.caseBuilder, and map its _type in the project query.

// Imports
// ------------
import { ImagesIcon } from '@sanity/icons/Images';
import { defineArrayMember, defineField, defineType } from 'sanity';

// Constants
// ------------
const MIN_IMAGES = 6;
const MAX_IMAGES = 9;
export const GALLERY_PREFIX = 'Animated Gallery — ';

// Helpers
// ------------
// NOTE • `aspect` is the card shape the animation crops every image to
const defineGallery = ({
	name,
	title,
	description,
	aspect,
}: {
	name: string;
	title: string;
	description: string;
	aspect: string;
}) =>
	defineType({
		name,
		title: `${GALLERY_PREFIX}${title}`,
		type: 'object',
		icon: ImagesIcon,
		description,
		fields: [
			defineField({
				name: 'images',
				title: 'Images',
				type: 'array',
				description: `Upload ${MIN_IMAGES}–${MAX_IMAGES} images; drag to set their order. Every card is shown at ${aspect} — set the hotspot to keep the subject in frame. Around 2000px wide is plenty.`,
				of: [
					defineArrayMember({
						type: 'image',
						options: { hotspot: true },
						fields: [
							defineField({
								name: 'alt',
								title: 'Alternative text',
								type: 'string',
								description: 'Describe what the image shows, for screen readers and search engines.',
								validation: rule => rule.required(),
							}),
						],
					}),
				],
				options: { layout: 'grid' },
				validation: rule =>
					rule
						.required()
						.min(MIN_IMAGES)
						.max(MAX_IMAGES)
						.error(
							`Add between ${MIN_IMAGES} and ${MAX_IMAGES} images so the loop reads as one continuous motion.`
						),
			}),
			defineField({
				name: 'background',
				title: 'Background',
				type: 'color',
				description: 'Behind the cards. Leave empty for the site’s light neutral.',
				options: { disableAlpha: true },
			}),
		],
		preview: {
			select: { images: 'images', first: 'images.0' },
			prepare: ({ images, first }) => {
				const count = Array.isArray(images) ? images.length : 0;
				return {
					title: `${GALLERY_PREFIX}${title}`,
					subtitle: `${count} image${count === 1 ? '' : 's'} · ${description}`,
					media: first ?? ImagesIcon,
				};
			},
		},
	});

// Exports
// ------------
export const caseGalleryScatterDrift = defineGallery({
	name: 'caseGalleryScatterDrift',
	title: 'Scatter Drift',
	description: 'A tilted collage of cards that drifts upward one card at a time, in a seamless loop.',
	aspect: '4:3',
});

export const caseGalleryPanorama = defineGallery({
	name: 'caseGalleryPanorama',
	title: 'Panorama',
	description: 'One card at a time, panning round a ring — each swings away left as the next turns in.',
	aspect: '3:4',
});

export const caseGalleryOrbit = defineGallery({
	name: 'caseGalleryOrbit',
	title: 'Orbit',
	description: 'Square cards in a ring that makes one slow, eased revolution per loop.',
	aspect: '1:1',
});
