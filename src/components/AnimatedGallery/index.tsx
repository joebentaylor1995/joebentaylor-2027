// Imports
// ------------
import type { ComponentType } from 'react';
import type { GalleryAnimation } from '@/data/projects';
// Styles + Interfaces
// ------------
import type * as I from './interface';
import Orbit from './Orbit';
import Panorama from './Panorama';
import ScatterDrift from './ScatterDrift';

// Constants
// ------------
// NOTE • One entry per "Animated Gallery — …" block in Sanity (caseGalleries.ts)
const ANIMATIONS: Record<GalleryAnimation, ComponentType<I.GalleryAnimationProps>> = {
	scatterDrift: ScatterDrift,
	panorama: Panorama,
	orbit: Orbit,
};

// Component
// ------------
const AnimatedGallery = ({ animation, ...props }: I.AnimatedGalleryProps) => {
	// Derived
	const Animation = ANIMATIONS[animation] ?? ScatterDrift;

	// Render
	return <Animation {...props} />;
};

// Exports
// ------------
AnimatedGallery.displayName = 'AnimatedGallery';
export default AnimatedGallery;
