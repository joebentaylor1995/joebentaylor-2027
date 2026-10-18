// Imports
// ------------

import { getProfilePanel } from '@/data/content';
import About from './About';
import CallToAction from './CallToAction';
import Introduction from './Introduction';
import Recognition from './Recognition';
import Reviews from './Reviews';
import Services from './Services';

// Styles
// ------------
import s from './styles.module.scss';
import Usps from './Usps';

// Component
// ------------
// NOTE • Content comes from Sanity's “Profile panel” singleton (cached, with
// a local fallback); each section's animation and interaction stays in code
const Profile = async () => {
	// Data
	const content = await getProfilePanel();

	// Render
	return (
		<section className={s.jacket}>
			<Introduction
				eyebrow={content.introEyebrow}
				titleLines={content.titleLines}
				paragraphs={content.introduction}
			/>
			<Usps
				designToolkit={content.designToolkit}
				developmentToolkit={content.developmentToolkit}
				keyboards={content.keyboards}
				featuredOn={content.featuredOn}
				cssda={content.cssda}
			/>
			<About paragraphs={content.about} images={content.aboutImages} />
			<Services intro={content.servicesIntro} services={content.services} />
			<Recognition intro={content.recognitionIntro} outro={content.recognitionOutro} awards={content.awards} />
			{content.reviews.length > 0 && <Reviews reviews={content.reviews} />}
			<CallToAction />
		</section>
	);
};

// Exports
// ------------
Profile.displayName = 'Profile';
export default Profile;
