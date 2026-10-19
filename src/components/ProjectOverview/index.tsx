// Imports
// ------------

import PageTitleReveal from '@parts/PageTitleReveal';
import SpecialHeading from '@parts/SpecialHeading';
import Image from 'next/image';

// Styles + Interfaces
// ------------
import type { ProjectOverviewProps } from './interface';
import s from './styles.module.scss';

// Component
// ------------
const ProjectOverview = ({ overview }: ProjectOverviewProps) => (
	<section className={s.jacket} aria-labelledby='project-overview-title' data-project-overview>
		<div className={s.heading}>
			<h2 id='project-overview-title' data-type='displayL'>
				<span>Project</span>
				<br />
				Overview
			</h2>
		</div>
		<div className={s.content} data-objectives-layout>
			<div className={s.label} data-objectives-label>
				<SpecialHeading text='Objectives' tag='h3' />
			</div>
			<div className={s.details}>
				<div className={s.objectives} data-type='bodyL'>
					{overview.objectives.map(paragraph => (
						<p key={paragraph}>
							<PageTitleReveal variant='words' trigger='view' replay>
								{paragraph}
							</PageTitleReveal>
						</p>
					))}
				</div>
				<div className={s.group} data-kind='deliverables'>
					<h3 data-type='bodyM'>Deliverables</h3>
					<ul className={s.deliverables} data-type='bodyM'>
						{overview.deliverables.map(item => (
							<li key={item}>{item}</li>
						))}
					</ul>
				</div>
				{/* NOTE • Credits and Recognition are optional — hidden when empty */}
				{overview.credits.length > 0 && (
					<div className={s.group}>
						<h3 data-type='bodyM'>Credits</h3>
						<ul className={s.credits}>
							{overview.credits.map(credit => (
								<li className={s.credit} key={credit.name}>
									{credit.image && (
										<Image
											src={credit.image}
											alt=''
											width={48}
											height={48}
											data-cursor-sticky
											data-cursor-fit
										/>
									)}
									<p data-type='bodyM'>
										{credit.name} <span data-type='bodyS'>{credit.role}</span>
									</p>
								</li>
							))}
						</ul>
					</div>
				)}
				{overview.recognition.length > 0 && (
					<div className={s.group}>
						<h3 data-type='bodyM'>Recognition</h3>
						<ul className={s.awards}>
							{overview.recognition.map(award => (
								<li key={`${award.name}-${award.organisation}`} data-type='bodyM'>
									{award.name}
									<span data-type='bodyS'>{award.organisation}</span>
								</li>
							))}
						</ul>
					</div>
				)}
				{overview.website ? (
					<a
						className={s.website}
						data-button-050=''
						data-cursor-sticky
						data-cursor-fit
						data-type='bodyS'
						href={overview.website}
						target='_blank'
						rel='noopener noreferrer'
					>
						<span className={s.websiteFill} aria-hidden='true' />
						<span className={s.websiteInner}>
							<span className={s.websiteText}>View Website</span>
						</span>
						<span className={s.srOnly}> (opens in a new tab)</span>
					</a>
				) : (
					<button className={s.website} data-type='bodyS' type='button' disabled>
						View Website
					</button>
				)}
			</div>
		</div>
	</section>
);

// Exports
// ------------
export default ProjectOverview;
