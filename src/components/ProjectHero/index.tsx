// Imports
// ------------

import PageTitleReveal from '@parts/PageTitleReveal';
import SpecialHeading from '@parts/SpecialHeading';
import Image from 'next/image';

// Styles + Interfaces
// ------------
import type { ProjectHeroProps } from './interface';
import s from './styles.module.scss';
import Water from './Water';

// Component
// ------------
const ProjectHero = ({ project, preview = false }: ProjectHeroProps) => (
	// NOTE • The case study streams in under Suspense, so the site loader and
	// Water can reach this section before React hydrates it and set
	// data-liquid-ready, data-water-text and --project-intro-scale on it. Those
	// attributes belong to that imperative code, so React shouldn't compare them
	// (this covers the section's own attributes only, not its children).
	<section
		className={s.jacket}
		aria-labelledby={preview ? undefined : 'project-title'}
		data-project-hero={!preview || undefined}
		suppressHydrationWarning
	>
		<div className={s.media} data-project-hero-media={!preview || undefined}>
			<Image
				className={s.image}
				src={project.hero.src}
				alt={project.hero.alt}
				fill
				sizes='100vw'
				quality={90}
				preload
			/>
		</div>
		{!preview && <Water />}

		<div className={s.copy} data-project-hero-copy>
			<div className={s.label}>
				<SpecialHeading text='Case Study' tag='p' />
			</div>
			<h1 id={preview ? undefined : 'project-title'} className={s.title} data-type='displayL'>
				{preview ? (
					project.title
				) : (
					<PageTitleReveal
						variant='wave'
						trigger='project'
						transparentStart
						waveDuration={1.6}
						waveEase='sine.inOut'
					>
						{project.title}
					</PageTitleReveal>
				)}
			</h1>
		</div>
	</section>
);

// Exports
// ------------
export default ProjectHero;
