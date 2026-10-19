import type { ReactNode } from 'react';

export interface PageTitleRevealProps {
	children: ReactNode;
	variant?: 'wave' | 'block' | 'words';
	trigger?: 'loader' | 'view' | 'project';
	replay?: boolean;
	transparentStart?: boolean;
	waveDuration?: number;
	waveEase?: string;
	waveDelay?: number;
}
