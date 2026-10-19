// Sanity CLI Configuration
// ------------
// NOTE • Used by `bunx sanity …` (schema deploy, dataset import, typegen).

// Imports
// ------------
import { defineCliConfig } from 'sanity/cli';

// Exports
// ------------
export default defineCliConfig({
	api: {
		projectId: process.env.NEXT_PUBLIC_SANITY_PROJECT_ID,
		dataset: process.env.NEXT_PUBLIC_SANITY_DATASET || 'production',
	},
});
