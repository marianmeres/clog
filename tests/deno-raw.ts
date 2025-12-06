import { createClog } from "../src/clog.ts";

const clog = createClog("deno-test", { color: "red" });

clog.log("hey");
