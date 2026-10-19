// Imports
// ------------
import Grid, { Col } from '@waffl';
// Styles
// ------------
import type { ProfilePanelContent } from '@/data/site';
import CssDesignAwards from './CssDesignAwards';
import FeaturedOn from './FeaturedOn';
import Keycap from './Keycap';
import GlobeMap from './Map';
import SingleUSP from './SingleUSP';
import s from './styles.module.scss';
import Toolkit from './Toolkit';

// Types
// ------------
type UspsProps = Pick<
	ProfilePanelContent,
	'designToolkit' | 'developmentToolkit' | 'keyboards' | 'featuredOn' | 'cssda'
>;

// Component
// ------------
// NOTE • Tile content comes from the Profile panel's “Highlights” in Sanity;
// the location tile (globe) is fixed artwork
const Usps = ({ designToolkit, developmentToolkit, keyboards, featuredOn, cssda }: UspsProps) => {
	// Render
	return (
		<section className={s.usps}>
			<Grid columnsDesktop={8}>
				<Col as='div' l='1/6'>
					<SingleUSP>
						<h3 data-type='bodyL' data-placement='top'>
							{designToolkit.title}
						</h3>

						<Toolkit items={designToolkit.tools} label={designToolkit.title} />
					</SingleUSP>
				</Col>

				<Col as='div' l='6/9'>
					<SingleUSP>
						<h3 data-type='bodyL' data-placement='top'>
							{keyboards.title}
							<span>
								{keyboards.count} {keyboards.count === 1 ? 'Board' : 'Boards'}
							</span>
						</h3>
						<Keycap />
					</SingleUSP>
				</Col>

				<Col as='div' l='1/5'>
					<SingleUSP linkLabel={featuredOn.linkLabel} href={featuredOn.url ?? undefined}>
						<h3 data-type='bodyL' data-placement='bottom'>
							{featuredOn.eyebrow}
							<span>{featuredOn.title}</span>
						</h3>

						{featuredOn.video && <FeaturedOn video={featuredOn.video} />}
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
					<SingleUSP linkLabel={cssda.linkLabel} href={cssda.url ?? undefined}>
						<h3 data-type='bodyL' data-placement='bottom'>
							{cssda.title}
						</h3>
						<CssDesignAwards image={cssda.image} alt={cssda.alt} />
					</SingleUSP>
				</Col>

				<Col as='div' l='4/9'>
					<SingleUSP>
						<h3 data-type='bodyL' data-placement='top'>
							{developmentToolkit.title}
						</h3>
						<Toolkit items={developmentToolkit.tools} label={developmentToolkit.title} />
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
