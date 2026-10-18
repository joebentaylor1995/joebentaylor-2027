// Credits → People
// ------------
// NOTE • One-off: turns inline credits ({ name, role, image }) into `person`
// documents referenced from the credit, keeping the role on the project.
// People get a deterministic ID from their name, so the same collaborator
// across projects (and drafts) collapses into one person.
// Run: bunx sanity migration run credits-to-people (dry run), then add --no-dry-run

// Imports
// ------------
import { at, createIfNotExists, defineMigration, patch, set, setIfMissing } from 'sanity/migrate';

// Helpers
// ------------
interface LegacyCredit {
	_key: string;
	name?: string;
	role?: string;
	image?: { _type: 'image'; asset?: { _ref: string }; hotspot?: unknown; crop?: unknown };
	person?: { _ref: string };
}

const personId = (name: string) =>
	`person-${name
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-|-$/g, '')}`;

// Exports
// ------------
export default defineMigration({
	title: 'Move inline credits into reusable people',
	documentTypes: ['project'],
	filter: 'count(credits[defined(name) && !defined(person)]) > 0',
	migrate: {
		document(doc) {
			const credits = (doc.credits ?? []) as LegacyCredit[];
			const people = credits
				.filter(credit => credit.name && !credit.person)
				.flatMap(credit => {
					const id = personId(credit.name as string);
					// NOTE • Drafts may lack the photo, so fill it in whichever copy runs last
					return [
						createIfNotExists({ _id: id, _type: 'person', name: credit.name }),
						...(credit.image?.asset ? [patch(id, at('image', setIfMissing(credit.image)))] : []),
					];
				});
			const next = credits.map(({ _key, name, role, person }) =>
				person || !name
					? { _key, _type: 'credit', person, role }
					: { _key, _type: 'credit', person: { _type: 'reference', _ref: personId(name) }, role }
			);
			return [...people, patch(doc._id, at('credits', set(next)))];
		},
	},
});
