// Award Organisations
// ------------
// NOTE • The awarding bodies and the awards each gives — seeds the Award
// Organisations pool in Sanity (migrations/awards-to-organisations and
// scripts/sanity-import.ts). Edit them in the Studio afterwards.

export interface AwardBody {
	name: string;
	awards: string[];
}

const GOLD_SILVER_BRONZE = ['Gold', 'Silver', 'Bronze'];
const LOGO_LOUNGE_FIRST_BOOK = 12;
const LOGO_LOUNGE_LAST_BOOK = 20;

export const awardBodies: AwardBody[] = [
	{ name: 'Awwwards', awards: ['SOTD', 'Honors', 'Dev'] },
	{ name: 'FWA', awards: ['SOTD'] },
	{ name: 'CSSDA', awards: ['SOTD', 'UI', 'UX', 'Innovation', 'Special Kudos'] },
	{ name: 'CSS Winner', awards: ['SOTD', 'Star'] },
	{ name: 'BestCSS', awards: ['SOTD'] },
	{ name: 'Orpetron', awards: ['SOTD', 'OWDA'] },
	{ name: 'WD Awards', awards: ['SOTD', 'Favourite'] },
	{ name: 'Mindsparkle', awards: ['SOTD'] },
	{ name: 'Red Dot', awards: ['Winner'] },
	{ name: 'GSAP', awards: ['SOTD'] },
	{ name: 'W3 Awards', awards: GOLD_SILVER_BRONZE },
	{ name: 'Anthem Awards', awards: GOLD_SILVER_BRONZE },
	{ name: 'Indigo Awards', awards: ['Gold', 'Silver'] },
	{
		name: 'LogoLounge',
		awards: Array.from(
			{ length: LOGO_LOUNGE_LAST_BOOK - LOGO_LOUNGE_FIRST_BOOK + 1 },
			(_, index) => `Book ${LOGO_LOUNGE_FIRST_BOOK + index}`
		),
	},
];

// NOTE • Case-, space- and punctuation-blind, so “BESTCSS” and “CSSWinner”
// still match their body when moving old free-text awards across
export const normaliseAwardName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');

export const awardBodyId = (name: string) => `awardBody-${normaliseAwardName(name)}`;
