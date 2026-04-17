/**
 * Symbol used to identify styled text objects created by `colored()`.
 * Using Symbol.for() ensures the same symbol across module instances.
 */
export const CLOG_STYLED: unique symbol = Symbol.for("@marianmeres/clog-styled");

/**
 * Styled text object that works with both `console.log(...obj)` and `clog(obj)`.
 * Implements `toString()` for safe string concatenation (returns plain text).
 */
export interface StyledText extends Iterable<string> {
	[CLOG_STYLED]: true;
	text: string;
	style: string;
	toString(): string;
}

/**
 * Safe color values optimized for readability on both light and dark backgrounds.
 * Based on perceptual adjustments from colors.html generator.
 *
 * This is the single source of truth for the clog color palette. `autoColor()`
 * picks from these values; the named shortcuts (`red`, `green`, …) reference
 * the same hexes.
 */
export const SAFE_COLORS = {
	gray: "#969696",
	grey: "#969696",
	red: "#d26565",
	orange: "#cba14d",
	yellow: "#cba14d", // same as orange - pure yellow is hard on light bg
	green: "#3dc73d",
	teal: "#4dcba1",
	cyan: "#4dcba1", // alias for teal
	blue: "#67afd3",
	purple: "#8e8ed4",
	magenta: "#b080c8",
	pink: "#be5b9d",
} as const;

export type ColorName = keyof typeof SAFE_COLORS;

/**
 * List of css colors with enough contrast on both light and dark backgrounds.
 * Human reviewed. `autoColor()` cycles through these based on a stable hash.
 *
 * Includes one extra hue (`#8eba36`) beyond `SAFE_COLORS` to widen the palette
 * for namespace auto-coloring.
 *
 * @see colors.html
 */
const AUTO_PALETTE: readonly string[] = [
	SAFE_COLORS.gray,
	SAFE_COLORS.red,
	SAFE_COLORS.orange,
	"#8eba36",
	SAFE_COLORS.green,
	SAFE_COLORS.teal,
	SAFE_COLORS.blue,
	SAFE_COLORS.purple,
	SAFE_COLORS.magenta,
	SAFE_COLORS.pink,
];

/** Per-namespace autoColor cache - deterministic, safe to memoize. */
const _autoColorCache = new Map<string, string>();

/**
 * Auto-picks a consistent color for a given namespace using a hash function.
 * The same namespace will always produce the same color, making it useful for
 * assigning stable colors to namespaces. Result is memoized per namespace.
 *
 * @param namespace - The string to generate a color for (typically a namespace).
 * @returns A CSS hex color from the predefined palette.
 */
export function autoColor(namespace: string): string {
	const cached = _autoColorCache.get(namespace);
	if (cached !== undefined) return cached;
	const color = AUTO_PALETTE[strHash(namespace) % AUTO_PALETTE.length];
	_autoColorCache.set(namespace, color);
	return color;
}

/**
 * Creates a styled text object that works with both `console.log` and `clog`.
 *
 * @param str - The text to style
 * @param color - CSS color string or "auto" for hash-based color
 * @returns A StyledText object that can be spread into console.log or passed to clog
 *
 * @example
 * ```typescript
 * // With console.log (spread syntax)
 * console.log(...colored("hello", "red"));
 *
 * // With clog (direct pass)
 * clog(colored("hello", "red"));
 *
 * // Mixed with other args
 * clog("prefix", colored("styled", "blue"), "suffix");
 * ```
 */
export function colored(str: string, color = "auto"): StyledText {
	const style = `color:${color === "auto" ? autoColor(str) : color}`;
	return {
		[CLOG_STYLED]: true as const,
		text: str,
		style,
		*[Symbol.iterator]() {
			yield `%c${str}`;
			yield style;
		},
		toString() {
			return str;
		},
	};
}

/** Shortcut: gray("text") → colored("text", "#969696") */
export const gray = (s: string): StyledText => colored(s, SAFE_COLORS.gray);
export const grey = gray;

/** Shortcut: red("text") → colored("text", "#d26565") */
export const red = (s: string): StyledText => colored(s, SAFE_COLORS.red);

/** Shortcut: orange("text") → colored("text", "#cba14d") */
export const orange = (s: string): StyledText => colored(s, SAFE_COLORS.orange);

/** Shortcut: yellow("text") → colored("text", "#cba14d") */
export const yellow = (s: string): StyledText => colored(s, SAFE_COLORS.yellow);

/** Shortcut: green("text") → colored("text", "#3dc73d") */
export const green = (s: string): StyledText => colored(s, SAFE_COLORS.green);

/** Shortcut: teal("text") → colored("text", "#4dcba1") */
export const teal = (s: string): StyledText => colored(s, SAFE_COLORS.teal);

/** Shortcut: cyan("text") → colored("text", "#4dcba1") */
export const cyan = teal;

/** Shortcut: blue("text") → colored("text", "#67afd3") */
export const blue = (s: string): StyledText => colored(s, SAFE_COLORS.blue);

/** Shortcut: purple("text") → colored("text", "#8e8ed4") */
export const purple = (s: string): StyledText => colored(s, SAFE_COLORS.purple);

/** Shortcut: magenta("text") → colored("text", "#b080c8") */
export const magenta = (s: string): StyledText => colored(s, SAFE_COLORS.magenta);

/** Shortcut: pink("text") → colored("text", "#be5b9d") */
export const pink = (s: string): StyledText => colored(s, SAFE_COLORS.pink);

// helpers

/**
 * a.k.a. "djb2"
 * Produces a consistent, positive 32-bit integer hash for a given string.
 * Values are always within 0..2^32-1. Used for stable namespace coloring.
 */
function strHash(str: string): number {
	let hash = 0;
	for (let i = 0; i < str.length; i++) {
		// `| 0` coerces the intermediate to int32, preventing precision loss
		hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
	}
	return hash >>> 0; // unsigned 32-bit
}
