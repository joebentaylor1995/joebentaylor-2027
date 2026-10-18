// Imports
// ------------

import PageTitleReveal from '@parts/PageTitleReveal';
import Grid, { Col } from '@waffl';
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

		<div className={s.title} data-project-hero-copy>
			<Grid>
				<Col as='h1' id={preview ? undefined : 'project-title'} data-type='displayL' l='2/12'>
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
				</Col>
			</Grid>
		</div>

		<div className={s.description} data-project-hero-copy>
			<Grid>
				<Col as='p' data-type='titleS' l='2/9'>
					<PageTitleReveal
						variant='wave'
						trigger='view'
						transparentStart
						waveDuration={1.6}
						waveEase='sine.inOut'
					>
						{project.description}
					</PageTitleReveal>
				</Col>
			</Grid>
		</div>
	</section>
);

// Exports
// ------------
export default ProjectHero;
