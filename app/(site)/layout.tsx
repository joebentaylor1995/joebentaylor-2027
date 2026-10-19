// Imports
// ------------

import Analytics from '@parts/Analytics';
import { consentScript } from '@parts/CookieBar/consent';
import Favicons from '@parts/Favicons';
import Header from '@parts/Header';
import LinkPreloader from '@parts/LinkPreloader';
import NavigationWave from '@parts/NavigationWave';
import Profile from '@parts/Profile';
import ProfileReveal from '@parts/ProfileReveal';
import ProjectsRibbon from '@parts/ProjectsRibbon';
import SanityDevSync from '@parts/SanityDevSync';
import SanityPreview from '@parts/SanityPreview';
import SiteLoader from '@parts/SiteLoader';
import SmoothScroll from '@parts/SmoothScroll';
import StructuredData from '@parts/StructuredData';
import { ppNeueMontreal, sequel } from '@theme/fonts';
import type { Metadata, Viewport } from 'next';
import { Suspense, ViewTransition } from 'react';
import { isSiteUrlConfigured, profile, siteUrl } from '@/config';
import { getSettings } from '@/data/content';
import { toContact } from '@/data/site';
import Providers from './Providers';

// Styles
// ------------
import '@css/tokens.css';
import '@css/global.scss';

// SEO
// ------------
// NOTE • Site-wide defaults, built from the Sanity “Global settings” singleton
// (falling back to `profile` in src/config.ts) — override per route with
// `metadata` or `generateMetadata`. The share image comes from
// opengraph-image beside this layout unless Global settings sets one.
export const generateMetadata = async (): Promise<Metadata> => {
	const settings = await getSettings();
	const defaultTitle = settings.seo?.title || `${settings.name} — ${settings.tagline}`;
	const description = settings.seo?.description || settings.description;
	const shareImage = settings.seo?.image
		? [{ url: `${settings.seo.image}?w=1200&h=630&fit=crop&fm=jpg`, width: 1200, height: 630 }]
		: undefined;

	return {
		metadataBase: new URL(siteUrl),
		title: {
			default: defaultTitle,
			template: `%s — ${settings.name}`,
		},
		description,
		applicationName: settings.name,
		authors: [{ name: settings.name, url: siteUrl }],
		creator: settings.name,
		publisher: settings.businessName,
		keywords: [settings.name, 'designer', 'developer', settings.location.locality, ...settings.knowsAbout],
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
			siteName: settings.name,
			locale: profile.locale,
			title: defaultTitle,
			description,
			...(shareImage && { images: shareImage }),
		},
		twitter: {
			card: 'summary_large_image',
			title: defaultTitle,
			description,
			...(shareImage && { images: shareImage }),
		},
	};
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	themeColor: '#1653FF',
};

// Component
// ------------
const RootLayout = async ({ children }: { children: React.ReactNode }) => {
	// NOTE • Cached Sanity read (see src/cms/sanity/client.ts) — the shell still prerenders
	const settings = await getSettings();

	return (
		<html
			lang='en'
			className={`${ppNeueMontreal.variable} ${sequel.variable}`}
			data-loader-boot
			data-loader-pending
			suppressHydrationWarning
		>
			<head>
				{/* Critical first-paint cover: must not wait for the loader's CSS chunk or hydration. */}
				<style>{`html[data-loader-boot]::before{content:"";position:fixed;inset:0;z-index:2147483646;background:#121212;animation:loader-boot-fallback 0s 9s forwards}html[data-loader-pending]::view-transition{display:none!important}@keyframes loader-boot-fallback{to{visibility:hidden;pointer-events:none}}`}</style>
				<noscript>
					<style>{'html[data-loader-boot]::before{display:none}'}</style>
				</noscript>
				{/* NOTE • Marks returning visitors' cookie choice before first paint, so the server-rendered CookieBar never flashes (src/components/CookieBar/consent.ts) */}
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: static inline script built from constants — no user input */}
				<script dangerouslySetInnerHTML={{ __html: consentScript }} />
				<Favicons />
				<StructuredData settings={settings} />
			</head>
			<body>
				<Providers contact={toContact(settings)}>
					<SiteLoader />
					<LinkPreloader />
					<NavigationWave>
						<ProfileReveal profile={<Profile />}>
							<Header />
							<ViewTransition name='page-viewport' update='none' default='none'>
								<main id='page'>
									<SmoothScroll>{children}</SmoothScroll>
									<Suspense fallback={null}>
										<ProjectsRibbon />
									</Suspense>
								</main>
							</ViewTransition>
						</ProfileReveal>
					</NavigationWave>

					<Analytics />

					{/* NOTE • Visual Editing overlays — only rendered in draft mode (Sanity Presentation).
					    Inside Providers so it can open the profile panel for Presentation */}
					<Suspense fallback={null}>
						<SanityPreview />
					</Suspense>

					{/* NOTE • Dev only: picks up Sanity publishes, which the webhook can't deliver to localhost */}
					{process.env.NODE_ENV === 'development' && <SanityDevSync />}

					{/* NOTE • A non-fixed Footer belongs inside the scrolled content — render it at the end of your page, inside SmoothScroll */}
				</Providers>
			</body>
		</html>
	);
};

// DisplayName added for better debugging in React DevTools
RootLayout.displayName = 'RootLayout';
export default RootLayout;
