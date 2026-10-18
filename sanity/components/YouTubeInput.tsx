// YouTube input
// ------------
// NOTE • Sanity's own URL field, with a live preview underneath playing the
// video exactly as the site will: muted, looping and without controls.

// Imports
// ------------
import { Card, Stack, Text } from '@sanity/ui';
import type { UrlInputProps } from 'sanity';
import { getYouTubeEmbedUrl, getYouTubeId } from '../../src/utils/youtube';

// Constants
// ------------
const PREVIEW_STYLE = { display: 'block', width: '100%', aspectRatio: '16 / 9', border: 0 } as const;

// Component
// ------------
export const YouTubeInput = (props: UrlInputProps) => {
	// Derived
	const id = getYouTubeId(props.value);

	// Render
	return (
		<Stack gap={3}>
			{props.renderDefault(props)}
			{id ? (
				<Card radius={2} overflow='hidden' tone='transparent'>
					<iframe
						key={id}
						src={getYouTubeEmbedUrl(id)}
						title='YouTube preview'
						allow='autoplay; encrypted-media; picture-in-picture'
						style={PREVIEW_STYLE}
					/>
				</Card>
			) : (
				props.value && (
					<Card padding={3} radius={2} tone='caution'>
						<Text size={1}>That doesn’t look like a YouTube video link.</Text>
					</Card>
				)
			)}
		</Stack>
	);
};
