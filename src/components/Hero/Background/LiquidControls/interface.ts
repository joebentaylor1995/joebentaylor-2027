// Imports
// ------------
import type { LiquidSettings } from '../liquid-settings';

// Types
// ------------
export interface LiquidControlsProps {
	settings: LiquidSettings;
	onChange: (settings: LiquidSettings) => void;
	onClose: () => void;
}
