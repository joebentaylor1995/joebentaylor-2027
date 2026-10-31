// Imports
// ------------
import { notFound } from 'next/navigation';

// Route config
// ------------
export const instant = false;

// Prerenders one placeholder path so the catch-all has a static shell
export function generateStaticParams() {
	return [{ missing: ['404'] }];
}

// Component
// ------------
// Keep unmatched website URLs in the shared shell so returning home uses
// the same NavigationWave and client navigation as the header logo.
export default async function MissingPage({ params }: { params: Promise<{ missing: string[] }> }) {
	// params must be awaited before notFound() is called
	await params;
	notFound();
}
