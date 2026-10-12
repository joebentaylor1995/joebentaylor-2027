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

// Component
// ------------
const Page = async () => {
	// const data = await getHomeData();

	return (
		<>
			<Hero
				heading='Digital Narrative Architect'
				desc='Building brands and digital worlds where logic meets emotion, craft meets code, and meaningful stories are made to be felt, not just seen.'
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
