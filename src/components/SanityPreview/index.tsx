// Imports
// ------------
import { draftMode } from 'next/headers';
import Overlays from './Overlays';

// Component
// ------------
// NOTE • Visual Editing for Sanity's Presentation tool. Renders nothing for
// normal visitors — the overlay code is only sent once draft mode is on
// (app/api/draft-mode/enable), so it costs the public site nothing.
const SanityPreview = async () => {
	// Context
	const { isEnabled } = await draftMode();

	// Render
	return isEnabled ? <Overlays /> : null;
};

// Exports
// ------------
SanityPreview.displayName = 'SanityPreview';
export default SanityPreview;
