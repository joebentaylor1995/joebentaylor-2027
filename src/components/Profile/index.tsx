// Imports
// ------------

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
const Profile = () => {
	// Render
	return (
		<section className={s.jacket}>
			<Introduction />
			<Usps />
			<About />
			<Services />
			<Recognition />
			<Reviews />
			<CallToAction />
		</section>
	);
};

// Exports
// ------------
Profile.displayName = 'Profile';
export default Profile;
