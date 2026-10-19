import type { Project } from '@/data/projects';

export interface ProjectHeroProps {
	project: Pick<Project, 'title' | 'description' | 'hero'>;
	preview?: boolean;
}
