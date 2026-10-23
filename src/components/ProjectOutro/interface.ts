import type { NextProject, Project } from '@/data/projects';

export interface ProjectOutroProps {
	review: Project['review'];
	nextProject: NextProject | null;
	// NOTE • 'contact' replaces Next Project with a call to open the contact modal (the project modal's ending)
	cta?: 'next' | 'contact';
}
