/**
 * List of css colors which should looks good (enough contrast) on both light and dark
 * backgrounds. Hand picked/filtered.
 *
 * @see colors.html
 */
const COLORS = [
	"#969696",
	"#d26565",
	"#cbac4d",
	"#78ba36",
	"#3dc760",
	"#5dd0d0",
	"#91a2d5",
	"#d4c2e5",
	"#c671b1",
];

/**
 * Auto-picks a consistent color for a given string using a hash function.
 * The same string will always produce the same color, making it useful for
 * assigning stable colors to namespaces.
 *
 * @param str - The string to generate a color for (typically a namespace).
 * @returns A CSS named color from the predefined palette.
 */
export function autoColor(str: string): string {
	return COLORS[strHash(str) % COLORS.length];
}

// helpers

/**
 * a.k.a. "djb2"
 * It ensures a consistent, positive numerical representation.
 * It preserves all 32 bits of information, maintaining the full collision space.
 * The resulting values are always within the range 0 to 4,294,967,295 (2^32 - 1)
 */
function strHash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		hash = (hash << 5) - hash + str.charCodeAt(i);
		hash = hash & hash; // Convert to 32bit integer
	}
	return hash >>> 0; // Convert to unsigned 32-bit integer
}

function generateDistinctColors(count: number) {
	if (count <= 0) return [];

	const colors = [];
	// Golden angle gives better perceptual distribution than even spacing
	const goldenAngle = 137.508;

	for (let i = 0; i < count; i++) {
		const hue = (i * goldenAngle) % 360;
		const saturation = 65; // High enough for vivid colors
		const lightness = 45; // Sweet spot for contrast on light & dark

		colors.push(hslToHex(hue, saturation, lightness));
	}

	return colors;
}

function hslToHex(h, s, l) {
	s /= 100;
	l /= 100;

	const c = (1 - Math.abs(2 * l - 1)) * s;
	const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
	const m = l - c / 2;

	let r, g, b;

	if (h < 60) {
		r = c;
		g = x;
		b = 0;
	} else if (h < 120) {
		r = x;
		g = c;
		b = 0;
	} else if (h < 180) {
		r = 0;
		g = c;
		b = x;
	} else if (h < 240) {
		r = 0;
		g = x;
		b = c;
	} else if (h < 300) {
		r = x;
		g = 0;
		b = c;
	} else {
		r = c;
		g = 0;
		b = x;
	}

	const toHex = (n) =>
		Math.round((n + m) * 255)
			.toString(16)
			.padStart(2, "0");

	return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}
