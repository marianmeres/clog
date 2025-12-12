import {
	colored,
	red,
	green,
	blue,
	yellow,
	pink,
	SAFE_COLORS,
} from "../src/colors.ts";
import { createClog } from "../src/clog.ts";

const clog = createClog("deno-raw");
// const clog = createClog("deno-raw", { color: "auto" });

clog("direct");
clog.log("log");
clog.debug("debug");

// Color shortcuts work even WITHOUT instance color config!
const plainClog = createClog("plain");
plainClog(
	"No color config, but",
	green("this is green"),
	"and",
	red("this is red")
);

// Works with console.log (spread syntax)
console.log(...colored("my red string", "red"));
console.log(...colored("my auto colored string", "auto"));

// Works with clog (direct pass - no spread needed)
clog(colored("my red string", "red"));
clog(colored("my auto colored string", "auto"));

// Mixed usage - preserves argument order
clog("prefix", colored("styled", "blue"), "suffix");
clog(colored("first", "red"), "middle", colored("last", "green"));

// Color shortcuts - most ergonomic!
clog("Status:", green("OK"));
clog("Error:", red("Failed to connect"));
clog(blue("Info:"), "Processing complete in", yellow("12ms"));
console.log(...pink("also works with console.log"));

//
clog("Status:" + green("OK"));

//
Object.entries(SAFE_COLORS).forEach(([name, color]) => {
	clog(colored(name, color));
});
