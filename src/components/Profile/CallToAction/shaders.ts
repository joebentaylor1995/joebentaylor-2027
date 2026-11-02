// Imports
// ------------
import { createRainFragmentShader, createRainVertexShader } from '@utils/digitalRainShaders';

// Shaders
// ------------
// The face relief is centred, blended with a dome so it reads as raised, and fades into ordinary rain as an oval.
export const vertexShader = createRainVertexShader({
	featherBody: `// Fade the silhouette into ordinary rain; retain contrast around the eyes and nose.
		vec2 p = (uv - vec2(0.5, 0.51)) / vec2(0.51, 0.54);
		float oval = 1.0 - smoothstep(0.58, 1.02, length(p));
		vec2 edge = min(uv, 1.0 - uv);
		return oval * smoothstep(0.0, 0.10, min(edge.x, edge.y));`,
	surfaceValue: 'mask * (0.34 * dome + 0.66 * value)',
	screenAnchor: 'u_resolution * 0.5',
	screenAnchorY: 'u_resolution.y * 0.5',
	rippleFalloff: 'exp(-(front / 125.0) * (front / 125.0))',
});

export const fragmentShader = createRainFragmentShader({
	blueDeclaration: '',
	blueValue: 'vec3(22.0, 83.0, 255.0) / 255.0',
});
