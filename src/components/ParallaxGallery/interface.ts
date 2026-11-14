// Types
// ------------
import type { GalleryImage } from '@/data/projects';

export interface ParallaxGalleryProps {
	images: GalleryImage[];
	// Responsive widths for the slide images, matching the tile they fill
	sizes: string;
}
