// Imports
// ------------

import SpecialHeading from '@parts/SpecialHeading';
import Grid, { Col } from '@waffl';
// Styles
// ------------
import s from './styles.module.scss';
import Title from './Title';

// Component
// ------------
const Introduction = () => {
	// Render
	return (
		<section className={s.jacket}>
			<Grid columnsDesktop={8}>
				<Col as='hgroup' l='1/9' className={s.header}>
					<SpecialHeading tag='h2' text='Bringing stories to life' revealOnOpen />
					<Title />

					<em data-type='bodyM'>Scroll</em>
				</Col>
			</Grid>

			<Grid columnsDesktop={8}>
				<Col as='div' l='1/4' className={s.heading}>
					<SpecialHeading tag='h2' text='Introduction' revealOnView />
				</Col>

				<Col as='div' l='4/9' className={s.text}>
					<p data-type='bodyL'>
						For over a decade, I’ve been designing and developing for agencies and brands across the UK and
						beyond — from global icons like Google and Global Citizen to the next generation of founders
						rewriting the rules of business with purpose and conviction.
					</p>
					<p data-type='bodyL'>
						I didn’t take the conventional route into design. No degree. No shortcuts. Just obsession,
						curiosity, and an unshakable drive to learn, refine, and master every facet of the creative
						process.
					</p>
				</Col>
			</Grid>
		</section>
	);
};

// Exports
// ------------
Introduction.displayName = 'Introduction';
export default Introduction;
