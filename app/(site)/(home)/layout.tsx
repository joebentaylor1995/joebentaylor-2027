// Imports
// ------------
import PageTransition from '@parts/PageTransition';
import { toMetadata } from '@utils/metadata';
import type { Metadata } from 'next';
import { getHome } from '@/data/content';

// SEO
// ------------
// NOTE • The home page keeps the site-wide title unless the Homepage singleton
// sets its own; it always adds its canonical URL (set per route, so other
// pages never inherit '/')
export const generateMetadata = async (): Promise<Metadata> => {
	const { seo } = await getHome();

	return { ...toMetadata(seo, { absoluteTitle: true }), alternates: { canonical: '/' } };
};

// Component
// ------------
const Layout = ({ children }: { children: React.ReactNode }) => {
	return <PageTransition>{children}</PageTransition>;
};

// Exports
// ------------
Layout.displayName = 'Layout';
export default Layout;
