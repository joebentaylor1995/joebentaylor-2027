// 3D Model Block
// ------------
// NOTE • A .glb model visitors can turn round. It never loads on its own: the
// poster shows until a visitor taps "View in 3D", and only then does the page
// fetch three.js and the model — so a heavy file costs nothing to everyone
// who scrolls past. Rendered by src/components/ModelViewer.

// Imports
// ------------
import { CubeIcon } from '@sanity/icons/Cube';
import { defineField, defineType } from 'sanity';

// Exports
// ------------
export const caseModel = defineType({
	name: 'caseModel',
	title: '3D model',
	type: 'object',
	icon: CubeIcon,
	description: 'A .glb model that turns on its own and can be dragged round — loaded only when a visitor asks.',
	fields: [
		defineField({
			name: 'model',
			title: 'Model (.glb)',
			type: 'file',
			description:
				'A binary glTF (.glb). Keep it under ~10 MB — compress textures, and Draco or meshopt geometry compression both work. It’s centred and framed automatically.',
			options: { accept: '.glb,model/gltf-binary' },
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'poster',
			title: 'Preview thumbnail',
			type: 'image',
			description:
				'Shown until a visitor opens the viewer — ideally a render of the model on the same background. Its shape sets the block’s shape.',
			options: { hotspot: true },
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'alt',
			title: 'Alternative text',
			type: 'string',
			description: 'Describe the model, for screen readers and search engines.',
			validation: rule => rule.required(),
		}),
		defineField({
			name: 'background',
			title: 'Background',
			type: 'color',
			description: 'Behind the model once it’s loaded. Leave empty for the site’s light neutral.',
			options: { disableAlpha: true },
		}),
	],
	preview: {
		select: { alt: 'alt', poster: 'poster' },
		prepare: ({ alt, poster }) => ({
			title: alt || '3D model',
			subtitle: '3D model · loads on request',
			media: poster ?? CubeIcon,
		}),
	},
});
