// Media Item Object
// ------------
// NOTE • An image, a short muted video loop, or a YouTube video. Uploaded
// loops are served straight from Sanity's file CDN, so keep them short,
// compressed and under ~10 MB — anything longer belongs on YouTube.

// Imports
// ------------
import { ImageIcon } from '@sanity/icons/Image';
import { PlayIcon } from '@sanity/icons/Play';
import { createElement } from 'react';
import { defineField, defineType, type PreviewValue } from 'sanity';
import { getYouTubeId, getYouTubeThumbnail } from '../../../src/utils/youtube';
import { CompressedVideoInput } from '../../components/CompressedVideoInput';
import { YouTubeInput } from '../../components/YouTubeInput';

// Helpers
// ------------
type Kind = 'image' | 'video' | 'youtube';
const kindOf = (parent: unknown) => ((parent as { kind?: Kind } | undefined)?.kind ?? 'image') as Kind;
export const KIND_LABELS: Record<Kind, string> = { image: 'Image', video: 'Video loop', youtube: 'YouTube' };

// NOTE • Shared with the builder blocks' previews (caseBlocks.ts)
type PreviewMedia = PreviewValue['media'];
export const previewMedia = (media: {
	kind?: Kind;
	image?: PreviewMedia;
	poster?: PreviewMedia;
	youtube?: string;
}): PreviewMedia => {
	const youtubeId = getYouTubeId(media.youtube);
	return {
		image: media.image,
		video: media.poster || PlayIcon,
		youtube: youtubeId
			? createElement('img', { src: getYouTubeThumbnail(youtubeId, 'hqdefault'), alt: '' })
			: PlayIcon,
	}[kindOf(media)];
};

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
					{ title: KIND_LABELS.image, value: 'image' },
					{ title: KIND_LABELS.video, value: 'video' },
					{ title: KIND_LABELS.youtube, value: 'youtube' },
				],
			},
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'image',
			title: 'Image',
			type: 'image',
			options: { hotspot: true },
			hidden: ({ parent }) => kindOf(parent) !== 'image',
			validation: rule =>
				rule.custom((value, { parent }) => (kindOf(parent) === 'image' && !value ? 'Add an image' : true)),
		}),
		defineField({
			name: 'video',
			title: 'Video loop',
			type: 'file',
			description: 'MP4, muted, a few seconds long. It autoplays and loops.',
			options: { accept: 'video/mp4,video/webm' },
			// NOTE • Compresses in the browser before upload (H.264, ≤1280px, sound removed)
			components: { input: CompressedVideoInput },
			hidden: ({ parent }) => kindOf(parent) !== 'video',
			validation: rule =>
				rule.custom((value, { parent }) => (kindOf(parent) === 'video' && !value ? 'Add a video' : true)),
		}),
		defineField({
			name: 'youtube',
			title: 'YouTube link',
			type: 'url',
			description:
				'Paste the video’s link, e.g. https://youtu.be/… — it plays in YouTube’s own player, with its controls. Visitors who haven’t accepted marketing cookies see its thumbnail instead.',
			placeholder: 'https://www.youtube.com/watch?v=…',
			components: { input: YouTubeInput },
			hidden: ({ parent }) => kindOf(parent) !== 'youtube',
			validation: rule =>
				rule.custom((value: string | undefined, { parent }) => {
					if (kindOf(parent) !== 'youtube') return true;
					if (!value) return 'Add a YouTube link';
					return getYouTubeId(value) ? true : 'Use a YouTube video link (watch, youtu.be or shorts)';
				}),
		}),
		defineField({
			name: 'poster',
			title: 'Video poster',
			type: 'image',
			description: 'Shown while the video loads.',
			hidden: ({ parent }) => kindOf(parent) !== 'video',
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
		select: { kind: 'kind', alt: 'alt', image: 'image', poster: 'poster', youtube: 'youtube' },
		prepare: ({ kind, alt, image, poster, youtube }) => ({
			title: alt || 'Untitled media',
			subtitle: KIND_LABELS[kindOf({ kind })],
			media: previewMedia({ kind, image, poster, youtube }),
		}),
	},
});
