// Test project catalogue
// ------------
// NOTE • Without Sanity (as in CI) /api/projects-ribbon/ deliberately returns an
// empty catalogue so production can never show demo projects — which leaves the
// ribbon nothing to render. Tests that need a ribbon get this fixed catalogue
// instead (tests/helpers/test.ts), built from the bundled ribbon assets and the
// Pocketchange fallback case study. A real CMS catalogue is used unchanged.

// Imports
// ------------
import type { Route } from '@playwright/test';

// Types
// ------------
export type CatalogueProject = {
	id: string;
	name: string;
	isReady: boolean;
	tags: string[];
	type: 'image' | 'video';
	poster: string;
	video?: string;
	href?: string;
};

export type Catalogue = { featured: CatalogueProject[]; all: CatalogueProject[]; placeholder?: string };

// Constants
// ------------
const ASSETS = '/projects-ribbon/assets/featured';
const VIDEO_POSTERS = new Set([1, 3, 5]);
const FEATURED_COUNT = 6;
const ALL_COUNT = 12;

const project = (index: number): CatalogueProject => {
	const number = String(index).padStart(2, '0');
	const isVideo = VIDEO_POSTERS.has(index);
	return {
		id: `test-project-${number}`,
		name: index === 1 ? 'Pocketchange' : `Test project ${number}`,
		isReady: false,
		tags: index === 1 ? ['Branding', 'Website'] : [],
		type: isVideo ? 'video' : 'image',
		poster: `${ASSETS}/${number}.jpg`,
		...(isVideo && { video: `${ASSETS}/${number}.mp4` }),
		...(index === 1 && { href: '/projects/pocketchange' }),
	};
};

// Exports
// ------------
export const testCatalogue = (): Catalogue => {
	const all = Array.from({ length: ALL_COUNT }, (_, index) => project(index + 1));
	return { featured: all.slice(0, FEATURED_COUNT), all };
};

// NOTE • The server's catalogue, or the test catalogue when the server has none
export const fetchCatalogue = async (route: Route) => {
	const response = await route.fetch();
	const data = (await response.json()) as Catalogue;
	return { response, data: data.featured?.length ? data : { ...data, ...testCatalogue() } };
};
