// Imports
// ------------
import type { ReactNode } from 'react';

// Types
// ------------
export interface PageTitleRevealProps {
	children: ReactNode;
	// Which text animation plays
	variant?: 'wave' | 'block' | 'words';
	// What starts the reveal: the site loader, scrolling into view, or a project opening
	trigger?: 'loader' | 'view' | 'project';
	replay?: boolean;
	transparentStart?: boolean;
	waveDuration?: number;
	waveEase?: string;
	waveDelay?: number;
}
