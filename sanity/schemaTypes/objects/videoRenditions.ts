// Video renditions field
// ------------
// NOTE • Extra field for a video file: the smaller copies CompressedVideoInput
// made at upload, widest last. The file's own asset is always the widest, so
// anything that ignores this field still gets a working video. Queries read it
// through VIDEO_SOURCES, which ignores it once the file itself has been replaced.

// Imports
// ------------
import { defineArrayMember, defineField } from 'sanity';

// Exports
// ------------
export const videoRenditionsField = defineField({
	name: 'renditions',
	title: 'Renditions',
	type: 'array',
	hidden: true,
	readOnly: true,
	of: [
		defineArrayMember({
			type: 'object',
			name: 'videoRendition',
			fields: [
				defineField({ name: 'width', title: 'Width', type: 'number' }),
				defineField({ name: 'file', title: 'File', type: 'file' }),
			],
		}),
	],
});
