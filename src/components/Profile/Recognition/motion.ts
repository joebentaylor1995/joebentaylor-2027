// Motion
// ------------
// Constrains a value to [min, max] (defaults to 0..1)
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
