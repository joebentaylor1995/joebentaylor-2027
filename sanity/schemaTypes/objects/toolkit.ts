// Toolkit Object
// ------------
// NOTE • One of the profile panel's physics toolkits (design / development).
// Each tool is a 98px rounded tile: a background colour plus one or more
// logo layers. A layer with no position is centred at 50 × 50px, which suits
// most square logos; set x/y/size/angle to art-direct one precisely.

// Imports
// ------------
import { defineArrayMember, defineField, defineType } from 'sanity';

// Constants
// ------------
export const TOOL_TILE_SIZE = 98;

// NOTE • Quick-pick swatches in the colour picker — the brand colours the
// current tiles use (the translucent ones are set with the alpha slider)
const TILE_SWATCHES = [
	'rgba(255,255,255,0.1)', // frosted — Figma, Higgsfield
	'#001e36', // Photoshop
	'#330000', // Illustrator
	'#146ef5', // Webflow
	'#7a40ed', // Jitter
	'#0ae448', // GSAP
	'#58c4dc', // React
	'#007acc', // TypeScript
	'#f34f29', // Git
	'#000000', // Next.js
];

// Exports
// ------------
export const toolLayer = defineType({
	name: 'toolLayer',
	title: 'Logo layer',
	type: 'object',
	fieldsets: [
		{
			name: 'position',
			title: `Position in the ${TOOL_TILE_SIZE}px tile`,
			description: 'Leave empty to centre the logo at 50 × 50px.',
			options: { collapsible: true, collapsed: true, columns: 5 },
		},
	],
	fields: [
		defineField({
			name: 'image',
			title: 'Logo',
			type: 'image',
			description: 'Transparent PNG or SVG.',
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'mask',
			title: 'Mask',
			type: 'image',
			description: 'Optional — only the logo’s pixels inside this shape are drawn.',
		}),
		defineField({ name: 'x', title: 'X', type: 'number', fieldset: 'position' }),
		defineField({ name: 'y', title: 'Y', type: 'number', fieldset: 'position' }),
		defineField({ name: 'width', title: 'Width', type: 'number', fieldset: 'position' }),
		defineField({ name: 'height', title: 'Height', type: 'number', fieldset: 'position' }),
		defineField({
			name: 'angle',
			title: 'Angle (°)',
			type: 'number',
			fieldset: 'position',
		}),
	],
	preview: { select: { media: 'image' }, prepare: ({ media }) => ({ title: 'Logo layer', media }) },
});

export const toolkit = defineType({
	name: 'toolkit',
	title: 'Toolkit',
	type: 'object',
	fields: [
		defineField({ name: 'title', title: 'Title', type: 'string', validation: rule => rule.required() }),
		defineField({
			name: 'tools',
			title: 'Tools',
			type: 'array',
			description: 'Each tool drops into the tile as a draggable block. Drag to reorder.',
			of: [
				defineArrayMember({
					type: 'object',
					name: 'tool',
					fields: [
						defineField({
							name: 'label',
							title: 'Name',
							type: 'string',
							validation: rule => rule.required(),
						}),
						defineField({
							name: 'background',
							title: 'Tile colour',
							type: 'color',
							description:
								'Pick a colour or type a hex code. Lower the transparency slider for a frosted tile.',
							options: { colorList: TILE_SWATCHES },
							validation: rule => rule.required(),
						}),
						defineField({
							name: 'layers',
							title: 'Logo',
							type: 'array',
							of: [defineArrayMember({ type: 'toolLayer' })],
							validation: rule => rule.required().min(1),
						}),
					],
					preview: {
						select: { title: 'label', subtitle: 'background.hex', media: 'layers.0.image' },
					},
				}),
			],
		}),
	],
});
