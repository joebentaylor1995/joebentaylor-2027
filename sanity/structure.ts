// Studio Structure
// ------------
// NOTE • Singletons get fixed document IDs (their type name), so editors open
// the one document rather than a list they could add duplicates to.

// Imports
// ------------
import { CaseIcon } from '@sanity/icons/Case';
import { CogIcon } from '@sanity/icons/Cog';
import { CommentIcon } from '@sanity/icons/Comment';
import { HomeIcon } from '@sanity/icons/Home';
import { ThListIcon } from '@sanity/icons/ThList';
import { UserIcon } from '@sanity/icons/User';
import { UsersIcon } from '@sanity/icons/Users';
import type { StructureBuilder, StructureResolver } from 'sanity/structure';

// Helpers
// ------------
const singleton = (S: StructureBuilder, type: string, title: string, icon: typeof CogIcon) =>
	S.listItem().title(title).id(type).icon(icon).child(S.document().schemaType(type).documentId(type).title(title));

// Exports
// ------------
export const structure: StructureResolver = S =>
	S.list()
		.title('Content')
		.items([
			singleton(S, 'settings', 'Global settings', CogIcon),
			S.divider(),
			singleton(S, 'homePage', 'Homepage', HomeIcon),
			singleton(S, 'profilePanel', 'Profile panel', UserIcon),
			singleton(S, 'projectsPage', 'Projects page', ThListIcon),
			S.divider(),
			S.listItem()
				.title('Projects')
				.icon(CaseIcon)
				.child(
					S.list()
						.title('Projects')
						.items([
							S.listItem()
								.title('Case studies')
								.child(
									S.documentTypeList('project')
										.title('Case studies')
										.filter('_type == "project" && hasCaseStudy == true')
								),
							S.listItem()
								.title('Listing only')
								.child(
									S.documentTypeList('project')
										.title('Listing only')
										.filter('_type == "project" && hasCaseStudy != true')
								),
							S.divider(),
							S.documentTypeListItem('project').title('All projects'),
						])
				),
			S.documentTypeListItem('projectTag').title('Project Tags').icon(ThListIcon),
			S.documentTypeListItem('review').title('Reviews').icon(CommentIcon),
			S.documentTypeListItem('person').title('People').icon(UsersIcon),
		]);
