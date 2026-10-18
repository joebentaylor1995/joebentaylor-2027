import type { ProjectCaseBlock, ProjectMedia } from '@/data/projects';

export interface ProjectCaseBuilderProps {
	blocks: ProjectCaseBlock[];
}
export interface SingleMediaProps {
	media: ProjectMedia;
}
export interface DualMediaProps {
	media: [ProjectMedia, ProjectMedia];
}
export interface MediaProps {
	media: ProjectMedia;
	sizes: string;
}
export interface VideoProps {
	media: Extract<ProjectMedia, { type: 'video' }>;
}
