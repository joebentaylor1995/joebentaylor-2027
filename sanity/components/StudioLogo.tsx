// Studio logo
// ------------
// NOTE • The workspace icon in the Studio's top-left corner (and its
// workspace menu). The Studio is embedded on the site's own origin, so the
// home-screen icon in /public loads straight from the site.

// Constants
// ------------
const LOGO_SRC = '/apple-touch-icon.png';

// NOTE • The Studio sizes the icon's box; the image only has to fill it
const fill = { display: 'block', width: '100%', height: '100%', objectFit: 'cover' } as const;

// Component
// ------------
export const StudioLogo = () => (
	// biome-ignore lint/performance/noImgElement: a tiny Studio-only icon — next/image's optimiser adds nothing here
	<img src={LOGO_SRC} alt='' style={fill} />
);
