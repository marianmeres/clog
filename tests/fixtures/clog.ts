/**
 * A consumer's own file that happens to be called `clog.ts`, the way apps name
 * a logging helper: its frames are the caller's and must survive stack capture.
 */

import type { Clog } from "../../src/clog.ts";

export function logFromHelper(clog: Clog): void {
	clog.log("from helper");
}
