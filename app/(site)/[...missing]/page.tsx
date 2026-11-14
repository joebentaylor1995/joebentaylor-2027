// Imports
// ------------
import { notFound } from 'next/navigation';

// Route config
// ------------
export const instant = false;
// NOTE • An unlisted param would otherwise get the App Shell straight away
// (Partial Prefetching), committing a 200 before notFound() runs — a soft 404.
// 'navigation' makes the first request wait for the complete render, so the
// status is a real 404 while the page still renders inside the site shell.
export const ensureStatic = 'navigation';

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
