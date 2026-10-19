// Remove Review Cut-outs
// ------------
// NOTE • One-off: case-study outros now use the review's avatar, so the
// retired cut-out fields are cleared (their assets stay in the media library).
// Run: bunx sanity migration run remove-review-cutouts (dry run), then add --no-dry-run

// Imports
// ------------
import { at, defineMigration, unset } from 'sanity/migrate';

// Exports
// ------------
export default defineMigration({
	title: 'Remove retired cut-out portrait fields from reviews',
	documentTypes: ['review'],
	filter: 'defined(cutout) || defined(cutoutBase)',
	migrate: {
		document: () => [at('cutout', unset()), at('cutoutBase', unset())],
	},
});
