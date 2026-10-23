import type { Project } from '@/data/projects';

export interface ProjectHeroProps {
	project: Pick<Project, 'title' | 'hero'>;
	preview?: boolean;
}
