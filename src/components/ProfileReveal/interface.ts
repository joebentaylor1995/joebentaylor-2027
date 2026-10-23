import type { ReactNode } from 'react';

export interface ProfileRevealProps {
	children: ReactNode;
	profile?: ReactNode;
	// NOTE • The layout's @modal slot — a non-featured case study shown in the same panel
	project?: ReactNode;
}
