// Imports
// ------------
import ProjectCaseBuilder from '@parts/ProjectCaseBuilder';
import ProjectOutro from '@parts/ProjectOutro';
import ProjectOverview from '@parts/ProjectOverview';
// Styles + Interfaces
// ------------
import type * as I from './interface';
import ProjectModalRoute from './Route';
import s from './styles.module.scss';

// Component
// ------------
// NOTE • A mini case study — not featured — shown in the profile panel instead
// of on its own hero page: the panel content opened straight away, with a
// contact call to action where a featured case study offers the next project
const ProjectModal = ({ project }: I.ProjectModalProps) => (
	<article className={s.jacket} aria-label={project.title} data-project-modal>
		<ProjectModalRoute href={`/projects/${project.slug}`} />
		{/* NOTE • No hero or introduction — the name leads straight into the overview */}
		<ProjectOverview overview={project.overview} eyebrow={project.title} />
		<ProjectCaseBuilder blocks={project.caseBuilder} />
		<ProjectOutro review={project.review} nextProject={null} cta='contact' />
	</article>
);

// Exports
// ------------
ProjectModal.displayName = 'ProjectModal';
export default ProjectModal;
