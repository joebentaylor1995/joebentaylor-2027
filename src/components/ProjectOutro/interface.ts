import type { Project } from '@/data/projects';

export interface ProjectOutroProps {
	review: Project['review'];
	nextProject: Project['nextProject'];
}
