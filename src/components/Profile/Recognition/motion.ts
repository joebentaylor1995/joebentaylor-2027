// Motion
// ------------
export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
// Frames 9 and 14 are unfinished placeholders in the source design.
export const AWARD_IDS = Array.from({ length: 54 }, (_, index) => index + 1).filter(id => id !== 9 && id !== 14);
