import type { NextProject, Project } from '@/data/projects';

export interface ProjectOutroProps {
	review: Project['review'];
	nextProject: NextProject | null;
}
