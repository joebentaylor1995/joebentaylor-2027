// Imports
// ------------
import { siteUrl } from '@/config';
import type { SiteSettings } from '@/data/site';

// Constants
// ------------
// NOTE • schema.org JSON-LD linking the person, his business and the site, so
// search engines and answer engines can build a knowledge panel and cite him
// correctly. Every fact comes from Sanity's Global settings (falling back to
// `profile` in src/config.ts).
const personId = `${siteUrl}/#person`;
const businessId = `${siteUrl}/#business`;
const websiteId = `${siteUrl}/#website`;

const buildGraph = (settings: SiteSettings) => {
	const sameAs = settings.socials.map(({ url }) => url);

	return {
		'@context': 'https://schema.org',
		'@graph': [
			{
				'@type': 'Person',
				'@id': personId,
				name: settings.name,
				url: siteUrl,
				email: `mailto:${settings.email}`,
				jobTitle: settings.jobTitle,
				description: settings.description,
				address: {
					'@type': 'PostalAddress',
					addressLocality: settings.location.locality,
					addressRegion: settings.location.region,
					addressCountry: settings.location.country,
				},
				worksFor: { '@id': businessId },
				knowsAbout: settings.knowsAbout,
				sameAs,
			},
			{
				'@type': 'ProfessionalService',
				'@id': businessId,
				name: settings.businessName,
				legalName: settings.businessName,
				url: siteUrl,
				email: settings.email,
				logo: `${siteUrl}/web-app-manifest-512x512.png`,
				founder: { '@id': personId },
				identifier: {
					'@type': 'PropertyValue',
					propertyID: 'Companies House company number',
					value: settings.companyNumber,
				},
				address: {
					'@type': 'PostalAddress',
					addressLocality: settings.location.locality,
					addressRegion: settings.location.region,
					addressCountry: settings.location.country,
				},
				areaServed: 'Worldwide',
				sameAs,
			},
			{
				'@type': 'WebSite',
				'@id': websiteId,
				name: settings.name,
				alternateName: settings.shortName,
				url: siteUrl,
				inLanguage: 'en-GB',
				description: settings.description,
				publisher: { '@id': businessId },
				about: { '@id': personId },
			},
		],
	};
};

// NOTE • `<` is escaped so the JSON can never close the script tag early
const toJson = (settings: SiteSettings) => JSON.stringify(buildGraph(settings)).replace(/</g, '\\u003c');

// Component
// ------------
const StructuredData = ({ settings }: { settings: SiteSettings }) => (
	// biome-ignore lint/security/noDangerouslySetInnerHtml: JSON-LD serialised by JSON.stringify with `<` escaped — can't break out of the tag
	<script type='application/ld+json' dangerouslySetInnerHTML={{ __html: toJson(settings) }} />
);

// Exports
// ------------
StructuredData.displayName = 'StructuredData';
export default StructuredData;
