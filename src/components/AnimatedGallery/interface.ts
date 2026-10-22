import type { ReactNode, Ref } from 'react';
import type { GalleryAnimation, GalleryImage } from '@/data/projects';

export interface AnimatedGalleryProps {
	animation: GalleryAnimation;
	images: GalleryImage[];
	background?: string | null;
	sizes: string;
}

export type GalleryAnimationProps = Omit<AnimatedGalleryProps, 'animation'>;

export interface StageProps {
	ref: Ref<HTMLDivElement>;
	background?: string | null;
	isPaused: boolean;
	onTogglePause: () => void;
	children: ReactNode;
}
