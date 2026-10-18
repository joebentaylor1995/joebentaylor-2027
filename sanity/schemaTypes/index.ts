// Sanity Schema Types
// ------------
// NOTE • Register every document/object type here — the Studio reads this
// list via sanity.config.ts. The content model is mapped out in
// docs/Sanity/ContentModel.md.

// Imports
// ------------
import { project } from './documents/project';
import { projectTag } from './documents/projectTag';
import { review } from './documents/review';
import { caseDual, caseSingle } from './objects/caseBlocks';
import { mediaItem } from './objects/mediaItem';
import { seo } from './objects/seo';
import { toolkit, toolLayer } from './objects/toolkit';
import { homePage } from './singletons/homePage';
import { profilePanel } from './singletons/profilePanel';
import { projectsPage } from './singletons/projectsPage';
import { settings } from './singletons/settings';

// Exports
// ------------
export const singletonTypes = new Set(['settings', 'homePage', 'profilePanel', 'projectsPage']);

export const schemaTypes = [
	// Singletons
	settings,
	homePage,
	profilePanel,
	projectsPage,
	// Documents
	project,
	projectTag,
	review,
	// Objects
	seo,
	mediaItem,
	caseSingle,
	caseDual,
	toolkit,
	toolLayer,
];
