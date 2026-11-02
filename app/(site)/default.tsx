import { notFound } from 'next/navigation';

// NOTE • Required by strict route matching: the @modal slot's catch-all also matches the Studio's
// URLs, so this layout's children slot needs a fallback there, even though the Studio renders from
// its own root layout. Anything that does reach it is a missing page.
const Default = () => notFound();

// Exports
// ------------
export default Default;
