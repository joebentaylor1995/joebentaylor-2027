// Imports
// ------------
import type { Project } from '@/data/projects';

// Types
// ------------
export interface ProjectOverviewProps {
	overview: Project['overview'];
	// NOTE • The project's name above "Project Overview" — a mini case study has no hero to carry it
	eyebrow?: string;
}
