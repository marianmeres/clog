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
