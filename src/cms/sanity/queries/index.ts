// GROQ Queries
// ------------
// NOTE • Singletons are fetched by their fixed document IDs (see
// sanity/structure.ts). Content model: docs/Sanity/ContentModel.md

// Imports
// ------------
import { defineQuery } from 'next-sanity';
import { MEDIA, REVIEW, RIBBON_PROJECT, SEO, TOOLKIT } from './fragments';

// Exports
// ------------
export const GET_GLOBAL = defineQuery(`
	*[_id == "settings"][0]{
		"projectsLive": projectsLive == true,
		name,
		shortName,
		tagline,
		jobTitle,
		description,
		knowsAbout,
		"seo": seo${SEO},
		email,
		bookingLink,
		location,
		"socials": socials[]{ platform, url },
		businessName,
		companyNumber,
		"resumeUrl": resume.asset->url
	}
`);

export const GET_HOME = defineQuery(`
	*[_id == "homePage"][0]{
		heading,
		description,
		"logos": clientLogos[defined(logo.asset)]{
			name,
			"image": logo.asset->url,
			"width": logo.asset->metadata.dimensions.width,
			"height": logo.asset->metadata.dimensions.height
		},
		"seo": seo${SEO}
	}
`);

export const GET_PROFILE_PANEL = defineQuery(`
	*[_id == "profilePanel"][0]{
		introEyebrow,
		titleLines,
		introduction,
		about,
		"aboutImages": aboutImages[defined(asset)]{ "src": asset->url, "alt": coalesce(alt, ""), hotspot },
		"designToolkit": designToolkit${TOOLKIT},
		"developmentToolkit": developmentToolkit${TOOLKIT},
		keyboards{ title, count },
		featuredOn{ eyebrow, title, linkLabel, url, "video": video.asset->url },
		cssda{ title, linkLabel, url, "image": image.asset->url, "alt": image.alt },
		"awards": awards[defined(asset)]{ "src": asset->url, "alt": coalesce(alt, ""), hotspot },
		"servicesIntro": servicesIntro[].children[]{ text, "highlight": "highlight" in coalesce(marks, []) },
		"services": services[]{ title, "image": image.asset->url },
		recognitionIntro,
		recognitionOutro,
		"reviews": reviews[]->${REVIEW}
	}
`);

export const GET_PROJECTS_PAGE = defineQuery(`
	*[_id == "projectsPage"][0]{
		// NOTE • The ribbon only shows case studies, even if a featured project is
		// later switched to listing-only; the grid takes any project
		"featured": featured[@->hasCaseStudy == true]->${RIBBON_PROJECT},
		"all": allProjects[]->${RIBBON_PROJECT},
		// NOTE • Every other project (listing-only included), newest first — so a
		// newly published project lands in the grid without being added by hand
		"others": *[
			_type == "project"
			&& !(_id in coalesce(^.featured[]._ref, []))
			&& !(_id in coalesce(^.allProjects[]._ref, []))
		] | order(_createdAt desc)${RIBBON_PROJECT},
		"seo": seo${SEO}
	}
`);

export const GET_PROJECT_SLUGS = defineQuery(`
	*[_type == "project" && hasCaseStudy == true && defined(slug.current)].slug.current
`);

export const GET_PROJECT = defineQuery(`
	*[_type == "project" && hasCaseStudy == true && slug.current == $slug][0]{
		"slug": slug.current,
		title,
		"description": coalesce(introduction, ""),
		"hero": { "src": heroImage.asset->url, "alt": coalesce(heroImage.alt, title) },
		"caseBuilder": caseBuilder[]{
			"id": _key,
			_type == "caseSingle" => { "type": "single", "media": media${MEDIA} },
			_type == "caseDual" => { "type": "dual", "media": media[]${MEDIA} }
		},
		"review": reviews[0]->{
			quote,
			author,
			"role": coalesce(role, company, ""),
			"image": avatar.asset->url
		},
		"nextProject": nextProject->{ "href": "/projects/" + slug.current },
		"overview": {
			objectives,
			deliverables,
			// NOTE • Falls back to legacy inline credits until migrations/credits-to-people has run
			"credits": credits[defined(person) || defined(name)]{
				"name": coalesce(person->name, name),
				"role": coalesce(role, ""),
				"image": coalesce(person->image.asset->url, image.asset->url)
			},
			// NOTE • organisation is the legacy free-text field, read until migrations/awards-to-organisations has run
			"recognition": recognition[defined(name)]{ name, "organisation": coalesce(body->name, organisation, "") },
			website
		},
		"seo": seo${SEO}
	}
`);
