// Imports
// ------------
import Hero from '@parts/Hero';
import { getHome } from '@/data/content';

// Component
// ------------
// NOTE • Content comes from the Sanity “Homepage” singleton, falling back to
// src/data/site.ts — getHome never throws, so the route can't crash on it
const Page = async () => {
	const { heading, description, logos } = await getHome();

	return <Hero heading={heading} desc={description} logos={logos} />;
};

// Exports
// ------------
export default Page;
