/**
 * Symbol used to identify styled text objects created by `colored()`.
 * Using Symbol.for() ensures the same symbol across module instances.
 */
export const CLOG_STYLED = Symbol.for("@marianmeres/clog-styled");

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
 * List of css colors which looks good (enough contrast) on both light and dark
 * backgrounds. Human reviewed.
 *
 * @see colors.html
 */
const COLORS = [
	"#969696",
	"#d26565",
	"#cba14d",
	"#8eba36",
	"#3dc73d",
	"#4dcba1",
	"#67afd3",
	"#8e8ed4",
	"#b080c8",
	"#be5b9d",
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

/**
 * Safe color values optimized for readability on both light and dark backgrounds.
 * Based on perceptual adjustments from colors.html generator.
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
