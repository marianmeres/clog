import { createClog } from "../src/clog.ts";

const clog = createClog("deno-test", { color: "auto" });

clog("direct");
clog.log("log");
clog.debug("debug");
clog.warn("warn");
clog.error("error");
