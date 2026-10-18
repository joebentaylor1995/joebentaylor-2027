// Media Item Object
// ------------
// NOTE • An image or a short muted video loop. Videos are served straight
// from Sanity's file CDN, so keep them short, compressed and under ~10 MB —
// long-form video belongs on Mux, YouTube or Vimeo.

// Imports
// ------------
import { ImageIcon } from '@sanity/icons/Image';
import { PlayIcon } from '@sanity/icons/Play';
import { defineField, defineType } from 'sanity';
import { CompressedVideoInput } from '../../components/CompressedVideoInput';

// Exports
// ------------
export const mediaItem = defineType({
	name: 'mediaItem',
	title: 'Media',
	type: 'object',
	icon: ImageIcon,
	fields: [
		defineField({
			name: 'kind',
			title: 'Type',
			type: 'string',
			initialValue: 'image',
			options: {
				layout: 'radio',
				direction: 'horizontal',
				list: [
					{ title: 'Image', value: 'image' },
					{ title: 'Video loop', value: 'video' },
				],
			},
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'image',
			title: 'Image',
			type: 'image',
			options: { hotspot: true },
			hidden: ({ parent }) => parent?.kind === 'video',
			validation: rule =>
				rule.custom((value, { parent }) =>
					(parent as { kind?: string })?.kind !== 'video' && !value ? 'Add an image' : true
				),
		}),
		defineField({
			name: 'video',
			title: 'Video loop',
			type: 'file',
			description: 'MP4, muted, a few seconds long. It autoplays and loops.',
			options: { accept: 'video/mp4,video/webm' },
			// NOTE • Compresses in the browser before upload (H.264, ≤1280px, sound removed)
			components: { input: CompressedVideoInput },
			hidden: ({ parent }) => parent?.kind !== 'video',
			validation: rule =>
				rule.custom((value, { parent }) =>
					(parent as { kind?: string })?.kind === 'video' && !value ? 'Add a video' : true
				),
		}),
		defineField({
			name: 'poster',
			title: 'Video poster',
			type: 'image',
			description: 'Shown while the video loads.',
			hidden: ({ parent }) => parent?.kind !== 'video',
		}),
		defineField({
			name: 'alt',
			title: 'Alternative text',
			type: 'string',
			description: 'Describe what the media shows, for screen readers and search engines.',
			validation: rule => rule.required(),
		}),
	],
	preview: {
		select: { kind: 'kind', alt: 'alt', image: 'image', poster: 'poster' },
		prepare: ({ kind, alt, image, poster }) => ({
			title: alt || 'Untitled media',
			subtitle: kind === 'video' ? 'Video loop' : 'Image',
			media: kind === 'video' ? poster || PlayIcon : image,
		}),
	},
});
