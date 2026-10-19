// Sanity Adapter
// ------------
// NOTE • Exposes the common CMS surface: fetchContent + query strings.
// The raw client is exported for advanced use (live preview, listeners).

// Exports
// ------------
export { client, fetchContent, isDraftMode, SANITY_CACHE_TAG, STUDIO_URL } from './client';
export {
	GET_GLOBAL,
	GET_HOME,
	GET_PROFILE_PANEL,
	GET_PROJECT,
	GET_PROJECT_SLUGS,
	GET_PROJECTS_PAGE,
} from './queries';
