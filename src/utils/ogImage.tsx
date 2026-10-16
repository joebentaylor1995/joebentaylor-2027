// Imports
// ------------
import { LOGO, LOGO_BOX } from '@parts/SiteLoader/logoPaths';
import { baseColors } from '@theme/colors';
import { ImageResponse } from 'next/og';
import { profile } from '@/config';

// Exports
// ------------
// NOTE • A generated share card. The site default is the static app/(site)/opengraph-image.jpg;
// give a page its own by adding an opengraph-image.tsx next to its page.tsx:
//
// import { createOgImage, ogImageSize } from '@utils/ogImage';
// export const size = ogImageSize;
// export const contentType = 'image/png';
// export default async function Image() {
// 	const data = await fetchContent(GET_PROJECT);
// 	return createOgImage({ title: data?.title ?? 'Project' });
// }
//
// NOTE • Rendered by Satori, not a browser: inline styles only, flexbox
// layout, and raw colour values (CSS variables don't exist here). The font
// is Next's built-in default — pass `fonts` to ImageResponse for your own.
export const ogImageSize = { width: 1200, height: 630 };

const LOGO_WIDTH = 360;
const LOGO_HEIGHT = (LOGO_WIDTH * LOGO_BOX.height) / LOGO_BOX.width;

type OgImageProps = {
	title: string;
	eyebrow?: string;
};

export const createOgImage = ({ title, eyebrow = 'joebentaylor.co.uk' }: OgImageProps) =>
	new ImageResponse(
		<div
			style={{
				display: 'flex',
				flexDirection: 'column',
				justifyContent: 'space-between',
				width: '100%',
				height: '100%',
				padding: 80,
				color: baseColors.global.white,
				background: baseColors.brand.c4,
			}}
		>
			<svg
				width={LOGO_WIDTH}
				height={LOGO_HEIGHT}
				viewBox={`0 0 ${LOGO_BOX.width} ${LOGO_BOX.height}`}
				fill={baseColors.global.white}
				role='img'
				aria-label={profile.name}
			>
				{LOGO.letters.map(d => (
					<path key={d} d={d} />
				))}
			</svg>
			<div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
				<div style={{ display: 'flex', width: 96, height: 8, background: baseColors.brand.c8 }} />
				<div style={{ display: 'flex', fontSize: 80, lineHeight: 1.05, letterSpacing: -2, maxWidth: 1000 }}>
					{title}
				</div>
				<div style={{ display: 'flex', fontSize: 30, opacity: 0.6 }}>{eyebrow}</div>
			</div>
		</div>,
		ogImageSize
	);
