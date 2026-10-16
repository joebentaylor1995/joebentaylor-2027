// Imports
// ------------

import Analytics from '@parts/Analytics';
import { consentScript } from '@parts/CookieBar/consent';
import Favicons from '@parts/Favicons';
import Header from '@parts/Header';
import Profile from '@parts/Profile';
import ProfileReveal from '@parts/ProfileReveal';
import SiteLoader from '@parts/SiteLoader';
import SmoothScroll from '@parts/SmoothScroll';
import StructuredData from '@parts/StructuredData';
import { ppNeueMontreal, sequel } from '@theme/fonts';
import type { Metadata, Viewport } from 'next';
import { isSiteUrlConfigured, profile, siteUrl } from '@/config';
import Providers from './Providers';

// Styles
// ------------
import '@css/tokens.css';
import '@css/global.scss';

// SEO
// ------------
// NOTE • Site-wide defaults, built from `profile` in src/config.ts — override
// per route with `metadata` or `generateMetadata`. The share image comes from
// opengraph-image.tsx beside this layout, which every route inherits.
export const metadata: Metadata = {
	metadataBase: new URL(siteUrl),
	title: {
		default: `${profile.name} — ${profile.tagline}`,
		template: `%s — ${profile.name}`,
	},
	description: profile.description,
	applicationName: profile.name,
	authors: [{ name: profile.name, url: siteUrl }],
	creator: profile.name,
	publisher: profile.business.name,
	keywords: [profile.name, 'designer', 'developer', 'Doncaster', ...profile.knowsAbout],
	category: 'design',
	formatDetection: { telephone: false, address: false, email: false },
	// NOTE • Indexing is gated on a real site URL — a deploy that forgot
	// NEXT_PUBLIC_SITE_URL can't be indexed under the fallback
	robots: {
		index: isSiteUrlConfigured,
		follow: isSiteUrlConfigured,
		googleBot: {
			index: isSiteUrlConfigured,
			follow: isSiteUrlConfigured,
			'max-image-preview': 'large',
			'max-snippet': -1,
			'max-video-preview': -1,
		},
	},
	openGraph: {
		type: 'website',
		siteName: profile.name,
		locale: profile.locale,
		title: `${profile.name} — ${profile.tagline}`,
		description: profile.description,
	},
	twitter: {
		card: 'summary_large_image',
		title: `${profile.name} — ${profile.tagline}`,
		description: profile.description,
	},
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	themeColor: '#1653FF',
};

// Component
// ------------
const RootLayout = ({ children }: { children: React.ReactNode }) => {
	return (
		<html lang='en' className={`${ppNeueMontreal.variable} ${sequel.variable}`} suppressHydrationWarning>
			<head>
				{/* NOTE • Marks returning visitors' cookie choice before first paint, so the server-rendered CookieBar never flashes (src/components/CookieBar/consent.ts) */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script built from constants — no user input */}
				<script dangerouslySetInnerHTML={{ __html: consentScript }} />
				<Favicons />
				<StructuredData />
			</head>
			<body>
				<Providers>
					<SiteLoader />
					<ProfileReveal profile={<Profile />}>
						<Header />
						<main id='page'>
							<SmoothScroll>{children}</SmoothScroll>
						</main>
					</ProfileReveal>

					<Analytics />

					{/* NOTE • A non-fixed Footer belongs inside the scrolled content — render it at the end of your page, inside SmoothScroll */}
				</Providers>
			</body>
		</html>
	);
};

// DisplayName added for better debugging in React DevTools
RootLayout.displayName = 'RootLayout';
export default RootLayout;
