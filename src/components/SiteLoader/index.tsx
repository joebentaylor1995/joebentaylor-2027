'use client';

// Imports
// ------------
import { type ComponentType, useEffect, useState } from 'react';

// Component
// ------------
// The concept gallery is opt-in until a production direction is chosen.
const SiteLoader = () => {
	const [Gallery, setGallery] = useState<ComponentType | null>(null);
	useEffect(() => {
		let active = true;
		if (new URLSearchParams(window.location.search).has('loaderConcepts')) {
			void import('./Gallery').then(module => {
				if (active) setGallery(() => module.default);
			});
		}
		return () => {
			active = false;
		};
	}, []);
	return Gallery ? <Gallery /> : null;
};

export default SiteLoader;
