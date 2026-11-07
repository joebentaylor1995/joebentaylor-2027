// Imports
// ------------
import type { ProjectCaseBlock, ProjectDualMedia, ProjectMedia } from '@/data/projects';

// Types
// ------------
export interface ProjectCaseBuilderProps {
	blocks: ProjectCaseBlock[];
}
export interface SingleMediaProps {
	media: ProjectMedia;
}
export interface DualMediaProps {
	media: [ProjectDualMedia, ProjectDualMedia];
}
export type ModelMediaProps = Omit<Extract<ProjectCaseBlock, { type: 'model' }>, 'id' | 'type'>;
export type GalleryMediaProps = Omit<Extract<ProjectCaseBlock, { type: 'gallery' }>, 'id' | 'type'>;
export type ParallaxMediaProps = Omit<Extract<ProjectCaseBlock, { type: 'parallax' }>, 'id' | 'type'>;
export type BeforeAfterMediaProps = Omit<Extract<ProjectCaseBlock, { type: 'beforeAfter' }>, 'id' | 'type'>;
export interface MediaProps {
	media: ProjectDualMedia;
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
