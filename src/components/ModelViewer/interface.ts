export interface ModelViewerProps {
	// The .glb — fetched only when a visitor opens the viewer
	src: string;
	poster: string;
	alt: string;
	background?: string | null;
	sizes: string;
}

export type ViewerStatus = 'idle' | 'loading' | 'ready' | 'error';
