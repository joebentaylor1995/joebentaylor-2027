// Awards → Award Organisations
// ------------
// NOTE • One-off: seeds the Award Organisations pool (src/data/awards.ts) and
// turns free-text awards ({ name, organisation }) into a `body` reference
// plus the award name. Unmatched entries are left as they are, so the
// Studio flags them for a manual pick.
// Run: bunx sanity migration run awards-to-organisations (dry run), then add --no-dry-run

// Imports
// ------------
import { at, createIfNotExists, defineMigration, patch, set } from 'sanity/migrate';
import { awardBodies, awardBodyId, normaliseAwardName } from '../../src/data/awards';

// Helpers
// ------------
interface LegacyAward {
	_key: string;
	name?: string;
	organisation?: string;
	body?: { _ref: string };
}

// NOTE • Old names that became a different award in the pool
const AWARD_ALIASES: Record<string, string> = { honorablemention: 'Honors' };

const bodiesByName = new Map(awardBodies.map(body => [normaliseAwardName(body.name), body]));

const toReference = (award: LegacyAward) => {
	const body = award.organisation && bodiesByName.get(normaliseAwardName(award.organisation));
	if (award.body || !body || !award.name) return award;
	const name = AWARD_ALIASES[normaliseAwardName(award.name)] ?? award.name;
	const match = body.awards.find(option => normaliseAwardName(option) === normaliseAwardName(name)) ?? name;
	return {
		_key: award._key,
		_type: 'award',
		body: { _type: 'reference', _ref: awardBodyId(body.name) },
		name: match,
	};
};

// Exports
// ------------
export default defineMigration({
	title: 'Move free-text awards into the Award Organisations pool',
	documentTypes: ['project'],
	filter: 'count(recognition[defined(organisation)]) > 0',
	migrate: {
		document(doc) {
			const seed = awardBodies.map(body =>
				createIfNotExists({ _id: awardBodyId(body.name), _type: 'awardBody', ...body })
			);
			const recognition = ((doc.recognition ?? []) as LegacyAward[]).map(toReference);
			return [...seed, patch(doc._id, at('recognition', set(recognition)))];
		},
	},
});
