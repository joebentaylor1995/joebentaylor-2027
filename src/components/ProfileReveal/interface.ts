// Imports
// ------------
import type { ReactNode } from 'react';

// Types
// ------------
export interface ProfileRevealProps {
	children: ReactNode;
	profile?: ReactNode;
	// NOTE • The layout's @modal slot — a non-featured case study shown in the same panel
	project?: ReactNode;
}
