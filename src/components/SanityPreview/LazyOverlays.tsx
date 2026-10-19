'use client';

// Imports
// ------------
import { lazy, Suspense } from 'react';

// Components
// ------------
// Keep the editor's dependency graph out of the public route's initial chunks.
const Overlays = lazy(() => import('./Overlays'));

const LazyOverlays = () => (
	<Suspense fallback={null}>
		<Overlays />
	</Suspense>
);

// Exports
// ------------
LazyOverlays.displayName = 'LazyOverlays';
export default LazyOverlays;
