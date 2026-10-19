import type { ToolkitItem } from '@parts/Profile/Usps/Toolkit/interface';

const asset = (set: string, name: string) => `/images/toolkit/${set}-${name}`;
const design = (name: string) => asset('design', name);
const development = (name: string) => asset('development', name);

// Artwork geometry comes from Figma's 98px tool blocks.
// ------------
export const designTools: readonly ToolkitItem[] = [
	{
		id: 'figma',
		label: 'Figma',
		background: 'rgba(255,255,255,0.1)',
		layers: [{ src: design('imgLogosFigmaOriginal.svg'), x: 24, y: 24, width: 50, height: 50.39 }],
	},
	{
		id: 'photoshop',
		label: 'Photoshop',
		background: '#001e36',
		layers: [{ src: design('imgRectangle445.png'), x: 19.818, y: 19.818, width: 58.364, height: 58.364 }],
	},
	{
		id: 'illustrator',
		label: 'Illustrator',
		background: '#330000',
		layers: [{ src: design('imgRectangle446.png'), x: 18, y: 17.58, width: 62, height: 63 }],
	},
	{
		id: 'higgsfield',
		label: 'Higgsfield',
		background: 'rgba(255,255,255,0.1)',
		layers: [
			{ src: design('imgRectangle447.png'), x: 24, y: 24, width: 50, height: 50 },
			{ src: design('imgImage71.png'), x: 0, y: 0, width: 98, height: 98 },
		],
	},
	{
		id: 'webflow',
		label: 'Webflow',
		background: '#146ef5',
		layers: [{ src: design('imgRectangle448.png'), x: 13.215, y: 13.215, width: 71.57, height: 71.57 }],
	},
	{
		id: 'jitter',
		label: 'Jitter',
		background: '#7a40ed',
		layers: [{ src: design('imgRectangle449.png'), x: 15.177, y: 15.177, width: 67.646, height: 67.646 }],
	},
];

export const developmentTools: readonly ToolkitItem[] = [
	{
		id: 'gsap',
		label: 'GSAP',
		background: '#0ae448',
		layers: [{ src: development('imgImage72.png'), x: 20, y: 20, width: 59, height: 59 }],
	},
	{
		id: 'react',
		label: 'React',
		background: '#58c4dc',
		layers: [
			{ src: development('imgGroup.svg'), x: 24.235, y: 27.373, width: 48.449, height: 43.259, angle: 1.32 },
		],
	},
	{
		id: 'typescript',
		label: 'TypeScript',
		background: '#007acc',
		layers: [
			{ src: development('imgLogosTypescriptPlain.svg'), x: 23.94, y: 23.08, width: 50, height: 50, angle: 0.28 },
		],
	},
	{
		id: 'git',
		label: 'Git',
		background: '#f34f29',
		layers: [{ src: development('imgFrame.svg'), x: 25, y: 24.58, width: 48, height: 48 }],
	},
	{
		id: 'nextjs',
		label: 'Next.js',
		background: '#000000',
		layers: [
			{
				src: development('imgGroup2.svg'),
				mask: development('imgGroup1.svg'),
				x: 14.29,
				y: 14.36,
				width: 68.222,
				height: 68.222,
				angle: 1.21,
			},
		],
	},
];
