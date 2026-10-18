import { defineField, defineType } from 'sanity';

export const projectTag = defineType({
	name: 'projectTag',
	title: 'Project tag',
	type: 'document',
	fields: [defineField({ name: 'title', title: 'Name', type: 'string', validation: rule => rule.required() })],
	orderings: [{ title: 'Name', name: 'titleAsc', by: [{ field: 'title', direction: 'asc' }] }],
	preview: { select: { title: 'title' } },
});
