// Projects Ribbon — data
// ------------
// NOTE • Feeds the WebGL ribbon runtime (public/projects-ribbon) the featured
// and all-projects lists from Sanity's “Projects page” singleton, in the
// shape its bundled JSON files use. Falls back to those files when Sanity
// has nothing published.

// Imports
// ------------
import { SANITY_CACHE_TAG } from '@cms';
import { revalidateTag } from 'next/cache';
import { NextResponse } from 'next/server';
import { stegaClean } from 'next-sanity';
import { areProjectsVisible, getProject, getProjectsPage } from '@/data/content';
import { PLACEHOLDER_IMAGE } from '@/data/site';

// Exports
// ------------
export const GET = async (request: Request) => {
	// NOTE • Hidden with the projects pages until “Projects live” is on in Sanity
	if (!(await areProjectsVisible())) return NextResponse.json({ error: 'Not found' }, { status: 404 });

	const slug = new URL(request.url).searchParams.get('project');
	if (slug) {
		const project = await getProject(slug);
		return project
			? NextResponse.json(
					stegaClean({ hero: project.hero.src, title: project.title, description: project.description })
				)
			: NextResponse.json({ error: 'Project not found' }, { status: 404 });
	}
	// Refresh local listings, but never invalidate prefetched routes while
	// warming a project's hero for an imminent transition.
	if (process.env.NODE_ENV === 'development') revalidateTag(SANITY_CACHE_TAG, { expire: 0 });
	const { featured, all } = await getProjectsPage();

	// NOTE • placeholder lets the runtime swap in a stand-in for any poster that fails to load
	return NextResponse.json({ featured, all, placeholder: PLACEHOLDER_IMAGE });
};
