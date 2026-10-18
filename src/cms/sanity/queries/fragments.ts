// GROQ Fragments
// ------------
// NOTE • Shared projections. Each one shapes Sanity data into the app's own
// types (src/data), so components never see Sanity's document structure.

// Exports
// ------------
export const SEO = /* groq */ `{ title, description, "image": image.asset->url }`;

export const REVIEW = /* groq */ `{
	quote,
	author,
	"company": coalesce(company, role, ""),
	"image": avatar.asset->url,
	"logo": logo.asset->url
}`;

export const MEDIA = /* groq */ `{
	"type": coalesce(kind, "image"),
	"alt": coalesce(alt, ""),
	// NOTE • Width ÷ height, so full-width tiles keep the media's own shape —
	// a video's comes from its poster (or its metadata once loaded, see Video.tsx)
	kind == "video" => { "src": video.asset->url, "poster": poster.asset->url, "aspect": poster.asset->metadata.dimensions.aspectRatio },
	kind == "youtube" => { "src": youtube },
	!(kind in ["video", "youtube"]) => { "src": image.asset->url, "aspect": image.asset->metadata.dimensions.aspectRatio }
}`;

// NOTE • A physics toolkit tile — layer geometry defaults are applied in
// src/data/content.ts, so only set values come back
export const TOOLKIT = /* groq */ `{
	title,
	"tools": tools[]{
		"id": _key,
		label,
		// NOTE • A colour-picker object ({ hex, rgb }); older plain strings pass through
		"background": select(defined(background.hex) => background{ hex, rgb }, background),
		"layers": layers[defined(image.asset)]{
			"src": image.asset->url,
			"mask": mask.asset->url,
			x,
			y,
			width,
			height,
			angle
		}
	}
}`;

// NOTE • The ribbon runtime (public/projects-ribbon) reads name/type/poster/
// video; href tells the host page where a click should go
export const RIBBON_PROJECT = /* groq */ `{
	"id": _id,
	"name": title,
	"tags": coalesce(tags[]->title, []),
	// NOTE • Thumbnail type picks the tile: an image, or a video loop whose
	// optional poster frame is the still (grid view, and while it loads)
	"type": select(thumbnailType == "video" && defined(previewVideo.asset) => "video", "image"),
	"poster": select(thumbnailType == "video" => videoPoster.asset->url, thumbnail.asset->url) + "?w=1600&fit=max&fm=jpg&q=80",
	"video": select(thumbnailType == "video" => previewVideo.asset->url, null),
	"href": select(hasCaseStudy == true => "/projects/" + slug.current, externalUrl)
}`;
