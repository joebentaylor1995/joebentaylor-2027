// Imports
// ------------
import Grid, { Col } from '@waffl';
import CssDesignAwards from './CssDesignAwards';
import FeaturedOn from './FeaturedOn';
import Keycap from './Keycap';
import GlobeMap from './Map';
import SingleUSP from './SingleUSP';

// Styles
// ------------
import s from './styles.module.scss';
import Toolkit from './Toolkit';
import { designTools, developmentTools } from './toolkits';

// Component
// ------------
const Usps = () => {
	// Render
	return (
		<section className={s.usps}>
			<Grid columnsDesktop={8}>
				<Col as='div' l='1/6'>
					<SingleUSP>
						<h3 data-type='bodyL' data-placement='top'>
							Design Toolkit
						</h3>

						<Toolkit items={designTools} label='Design toolkit' />
					</SingleUSP>
				</Col>

				<Col as='div' l='6/9'>
					<SingleUSP>
						<h3 data-type='bodyL' data-placement='top'>
							Keyboard Collector
							<span>10 Boards</span>
						</h3>
						<Keycap />
					</SingleUSP>
				</Col>

				<Col as='div' l='1/5'>
					<SingleUSP
						linkLabel='Featured on Codrops'
						href='https://tympanus.net/codrops/2026/05/28/the-never-ending-story-building-a-seamless-infinite-scroll-experience-with-gsap-lenis/'
					>
						<h3 data-type='bodyL' data-placement='bottom'>
							Featured on
							<span>Codrops</span>
						</h3>

						<FeaturedOn />
					</SingleUSP>
				</Col>

				<Col as='div' l='5/9'>
					<SingleUSP>
						<h3 data-type='bodyL' data-placement='top'>
							United Kingdom
							<span>Doncaster</span>
						</h3>
						<GlobeMap />
					</SingleUSP>
				</Col>

				<Col as='div' l='1/4'>
					<SingleUSP linkLabel='CSSDA Judge' href='https://www.cssdesignawards.com/judges/joe-taylor/1893/'>
						<h3 data-type='bodyL' data-placement='bottom'>
							CSSDA Judge
						</h3>
						<CssDesignAwards />
					</SingleUSP>
				</Col>

				<Col as='div' l='4/9'>
					<SingleUSP>
						<h3 data-type='bodyL' data-placement='top'>
							Development Toolkit
						</h3>
						<Toolkit items={developmentTools} label='Development toolkit' />
					</SingleUSP>
				</Col>
			</Grid>
		</section>
	);
};

// Exports
// ------------
Usps.displayName = 'Usps';
export default Usps;
