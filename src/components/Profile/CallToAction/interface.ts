// Types
// ------------
export interface MatrixScene {
	// Settles once the GL setup has finished (or failed), so prepareScene's queue builds one
	// scene at a time
	prepared: Promise<void>;
	setVisible: (visible: boolean) => void;
	destroy: () => void;
}
