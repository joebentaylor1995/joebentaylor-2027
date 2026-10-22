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
export type GalleryMediaProps = Omit<Extract<ProjectCaseBlock, { type: 'gallery' }>, 'id' | 'type'>;
export interface MediaProps {
	media: ProjectMedia;
	sizes: string;
}
export interface VideoProps {
	media: Extract<ProjectMedia, { type: 'video' }>;
}
export interface YouTubeProps {
	media: Extract<ProjectMedia, { type: 'youtube' }>;
	sizes: string;
}
export interface YouTubePlayerProps {
	id: string;
	title: string;
}
