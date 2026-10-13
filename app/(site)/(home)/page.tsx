// Imports
// ------------
// import { fetchContent, GET_HOME } from '@cms';
import Hero from '@parts/Hero';

// Data fetching at build time
// ------------
// NOTE • fetchContent returns null (never throws) when the CMS is missing
// or unconfigured, so wiring this up can't crash the route
// async function getHomeData() {
// 	return await fetchContent(GET_HOME);
// }

const DUMMY_LOGOS = [
	{ name: 'Google', image: '/images/logos/google.png', width: 230, height: 72 },
	{ name: 'Hilton', image: '/images/logos/hilton.png', width: 192, height: 132 },
	{ name: 'Durst', image: '/images/logos/durst.png', width: 204, height: 86 },
	{ name: 'Global Citizen', image: '/images/logos/globalcitizen.png', width: 248, height: 98 },
	{ name: 'Game', image: '/images/logos/game.png', width: 204, height: 64 },
	{ name: 'Missguided', image: '/images/logos/missguided.png', width: 270, height: 62 },
	{ name: 'Meta', image: '/images/logos/meta.png', width: 238, height: 48 },
	{ name: 'Estee Lauder', image: '/images/logos/esteelauder.png', width: 200, height: 118 },
	{ name: 'Nationwide', image: '/images/logos/nationwide.png', width: 308, height: 40 },
	{ name: 'Halfords', image: '/images/logos/halfords.png', width: 248, height: 52 },
	{ name: 'Spireworks', image: '/images/logos/spireworks.png', width: 278, height: 32 },
	{ name: 'Polypipe', image: '/images/logos/polypipe.png', width: 276, height: 62 },
	{ name: 'Uswitch', image: '/images/logos/uswitch.png', width: 290, height: 74 },
	{ name: 'Symphony', image: '/images/logos/symphony.png', width: 288, height: 64 },
	{ name: 'Footprint', image: '/images/logos/footprint.png', width: 280, height: 76 },
	{ name: 'BLLA', image: '/images/logos/blla.png', width: 225, height: 58 },
	{ name: 'Ideal Heating', image: '/images/logos/ideaheating.png', width: 200, height: 108 },
];

// Component
// ------------
const Page = async () => {
	// const data = await getHomeData();

	return (
		<>
			<Hero
				heading='Digital Narrative Architect'
				desc='Building brands and digital worlds where logic meets emotion, craft meets code, and meaningful stories are made to be felt, not just seen.'
				logos={DUMMY_LOGOS}
			/>

			{/*  */}
			{/*  */}
			{/*  */}
			{/*  */}
			{/*  */}
			{/*  */}
			{/*  */}
		</>
	);
};

// Exports
// ------------
export default Page;
