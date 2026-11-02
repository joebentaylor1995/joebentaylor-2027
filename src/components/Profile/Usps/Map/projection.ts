// Constants
// ------------
export const DONCASTER = { latitude: 53.5228, longitude: -1.1285 };

// Captured from the user's manually selected position in the profile map.
export const SETTLED = { latitude: 11.56014655, longitude: 31.79766895 };

// Where the intro spin starts from, offset from the settled view
export const START = { latitude: SETTLED.latitude + 5, longitude: SETTLED.longitude - 28 };

// Fixed view the globe is framed against (see framing())
const FRAMING_VIEW = { latitude: 3, longitude: 44 };

// Degrees to radians
export const RAD = Math.PI / 180;

// Types
// ------------
export type View = { latitude: number; longitude: number };

// Helpers
// ------------
// Longitude/latitude (degrees) to a point on the unit sphere
export function xyz(longitude: number, latitude: number): [number, number, number] {
	return [
		Math.cos(latitude * RAD) * Math.sin(longitude * RAD),
		Math.sin(latitude * RAD),
		Math.cos(latitude * RAD) * Math.cos(longitude * RAD),
	];
}

// 3x3 column-major matrix that turns the globe to face the given view
export function rotation(view: View) {
	const a = view.longitude * RAD,
		b = view.latitude * RAD;
	const sa = Math.sin(a),
		ca = Math.cos(a),
		sb = Math.sin(b),
		cb = Math.cos(b);
	return [ca, -sb * sa, cb * sa, 0, cb, sb, -sa, -sb * ca, cb * ca];
}

// Doncaster's position after rotation: x/y on screen, z towards the viewer (negative = behind the globe)
export function projectLocation(matrix: number[]) {
	const p = xyz(DONCASTER.longitude, DONCASTER.latitude);
	return {
		x: matrix[0] * p[0] + matrix[3] * p[1] + matrix[6] * p[2],
		y: matrix[1] * p[0] + matrix[4] * p[1] + matrix[7] * p[2],
		z: matrix[2] * p[0] + matrix[5] * p[1] + matrix[8] * p[2],
	};
}

// Globe radius and centre (in px) for a card of this size; the numbers fit the 440x325 design
export function framing(width: number, height: number) {
	const radius = Math.max(height * 1.34, width * 0.99);
	const destination = projectLocation(rotation(FRAMING_VIEW));
	return {
		radius,
		x: width * (217 / 440) - destination.x * radius,
		y: height * (157 / 325) + destination.y * radius,
	};
}
