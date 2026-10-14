import type { LiquidSettings } from '../liquid-settings';

export interface LiquidControlsProps {
	settings: LiquidSettings;
	onChange: (settings: LiquidSettings) => void;
	onClose: () => void;
}
