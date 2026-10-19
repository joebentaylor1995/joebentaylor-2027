// Imports
// ------------

import SpecialHeading from '@parts/SpecialHeading';
import Grid, { Col } from '@waffl';
// Styles
// ------------
import s from './styles.module.scss';
import Title from './Title';

// Types
// ------------
interface IntroductionProps {
	eyebrow: string;
	titleLines: string[];
	paragraphs: string[];
}

// Component
// ------------
const Introduction = ({ eyebrow, titleLines, paragraphs }: IntroductionProps) => {
	// Render
	return (
		<section className={s.jacket}>
			<Grid columnsDesktop={8}>
				<Col as='hgroup' l='1/9' className={s.header}>
					<SpecialHeading tag='h2' text={eyebrow} revealOnOpen />
					<Title lines={titleLines} />

					<em data-type='bodyM'>Scroll</em>
				</Col>
			</Grid>

			<Grid columnsDesktop={8}>
				<Col as='div' l='1/4' className={s.heading}>
					<SpecialHeading tag='h2' text='Introduction' revealOnView />
				</Col>

				<Col as='div' l='4/9' className={s.text}>
					{paragraphs.map(paragraph => (
						<p key={paragraph} data-type='bodyL'>
							{paragraph}
						</p>
					))}
				</Col>
			</Grid>
		</section>
	);
};

// Exports
// ------------
Introduction.displayName = 'Introduction';
export default Introduction;
