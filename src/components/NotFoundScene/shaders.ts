// Imports
// ------------
import { createRainFragmentShader, createRainVertexShader } from '@utils/digitalRainShaders';

// Shaders
// ------------
// The 404 relief sits above centre with no dome, keeps the numerals' outer edges, and takes its blue from a uniform.
export const vertex = createRainVertexShader({
	featherBody: `// Retain all three numerals, including the outer edges of each four.
		vec2 edge = min(uv, 1.0 - uv);
		return smoothstep(0.0, 0.025, min(edge.x, edge.y));`,
	surfaceValue: 'mask * value',
	screenAnchor: 'vec2(u_resolution.x * 0.5, u_resolution.y * 0.43)',
	screenAnchorY: 'u_resolution.y * 0.43',
	rippleFalloff: 'exp(-pow(front / 125.0, 2.0))',
});

export const fragment = createRainFragmentShader({
	blueDeclaration: 'uniform vec3 u_blue;',
	blueValue: 'u_blue',
});
