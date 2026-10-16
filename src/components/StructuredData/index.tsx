// Imports
// ------------
import { profile, siteUrl } from '@/config';

// Constants
// ------------
// NOTE • schema.org JSON-LD linking the person, his business and the site, so
// search engines and answer engines can build a knowledge panel and cite him
// correctly. Every fact comes from `profile` in src/config.ts.
const personId = `${siteUrl}/#person`;
const businessId = `${siteUrl}/#business`;
const websiteId = `${siteUrl}/#website`;

const graph = {
	'@context': 'https://schema.org',
	'@graph': [
		{
			'@type': 'Person',
			'@id': personId,
			name: profile.name,
			url: siteUrl,
			email: `mailto:${profile.email}`,
			jobTitle: profile.jobTitle,
			description: profile.description,
			address: {
				'@type': 'PostalAddress',
				addressLocality: profile.location.locality,
				addressRegion: profile.location.region,
				addressCountry: profile.location.country,
			},
			worksFor: { '@id': businessId },
			knowsAbout: profile.knowsAbout,
			sameAs: profile.sameAs,
		},
		{
			'@type': 'ProfessionalService',
			'@id': businessId,
			name: profile.business.name,
			legalName: profile.business.name,
			url: siteUrl,
			email: profile.email,
			logo: `${siteUrl}/web-app-manifest-512x512.png`,
			founder: { '@id': personId },
			identifier: {
				'@type': 'PropertyValue',
				propertyID: 'Companies House company number',
				value: profile.business.companyNumber,
			},
			address: {
				'@type': 'PostalAddress',
				addressLocality: profile.location.locality,
				addressRegion: profile.location.region,
				addressCountry: profile.location.country,
			},
			areaServed: 'Worldwide',
			sameAs: profile.sameAs,
		},
		{
			'@type': 'WebSite',
			'@id': websiteId,
			name: profile.name,
			alternateName: profile.shortName,
			url: siteUrl,
			inLanguage: 'en-GB',
			description: profile.description,
			publisher: { '@id': businessId },
			about: { '@id': personId },
		},
	],
};

// NOTE • `<` is escaped so the JSON can never close the script tag early
const json = JSON.stringify(graph).replace(/</g, '\\u003c');

// Component
// ------------
const StructuredData = () => (
	// biome-ignore lint/security/noDangerouslySetInnerHtml: static JSON-LD built from constants — no user input
	<script type='application/ld+json' dangerouslySetInnerHTML={{ __html: json }} />
);

// Exports
// ------------
StructuredData.displayName = 'StructuredData';
export default StructuredData;
