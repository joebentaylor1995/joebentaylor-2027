export interface ToolkitLayer {
	src: string;
	x: number;
	y: number;
	width: number;
	height: number;
	angle?: number;
	mask?: string;
}

export interface ToolkitItem {
	id: string;
	label: string;
	background: string;
	layers: readonly ToolkitLayer[];
}

export interface ToolkitProps {
	label: string;
	items: readonly ToolkitItem[];
}
