// Types
// ------------
import type { GalleryImage } from '@/data/projects';

export interface BeforeAfterProps {
	before: GalleryImage;
	after: GalleryImage;
	// Where the handle starts, as a percent from the left
	start: number;
	// Responsive widths for both images, matching the tile they fill
	sizes: string;
}
