import { notFound } from 'next/navigation';

export const instant = false;

export function generateStaticParams() {
	return [{ missing: ['404'] }];
}

// Keep unmatched website URLs in the shared shell so returning home uses
// the same NavigationWave and client navigation as the header logo.
export default async function MissingPage({ params }: { params: Promise<{ missing: string[] }> }) {
	await params;
	notFound();
}
