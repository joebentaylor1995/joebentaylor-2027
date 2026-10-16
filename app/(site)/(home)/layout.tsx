// Imports
// ------------
import PageTransition from '@parts/PageTransition';
import type { Metadata } from 'next';

// SEO
// ------------
// NOTE • The home page uses the site-wide title and description; it only adds
// its canonical URL (set per route, so other pages never inherit '/')
export const metadata: Metadata = {
	alternates: { canonical: '/' },
};

// NOTE • Site-wide defaults live in app/(site)/layout.tsx — only add what this route
// changes. With a CMS wired up, swap the static object for generateMetadata:
//
// export async function generateMetadata(): Promise<Metadata> {
// 	const data = await getHomeData();
//
// 	return {
// 		title: data?.seo?.title,
// 		description: data?.seo?.desc,
// 		openGraph: {
// 			images: [{ url: data?.seo?.image?.url, width: 1200, height: 630 }],
// 		},
// 	};
// }

// Component
// ------------
const Layout = ({ children }: { children: React.ReactNode }) => {
	return <PageTransition>{children}</PageTransition>;
};

// Exports
// ------------
Layout.displayName = 'Layout';
export default Layout;
