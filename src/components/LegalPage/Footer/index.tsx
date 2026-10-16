'use client';

// Imports
// ------------
import CallToAction from '@parts/Profile/CallToAction';
import { ProfilePresenceContext } from '@parts/ProfileReveal/context';

// Component
// ------------
// NOTE • Reuses the profile's Connect section as the page footer. Presence is
// always on here — outside the profile panel its observers fall back to the
// viewport, and `data-heading-reveal='page'` lets SpecialHeading animate in.
const Footer = () => {
	// Render
	return (
		<div data-heading-reveal='page'>
			<ProfilePresenceContext value>
				<CallToAction />
			</ProfilePresenceContext>
		</div>
	);
};

// Exports
// ------------
Footer.displayName = 'LegalFooter';
export default Footer;
