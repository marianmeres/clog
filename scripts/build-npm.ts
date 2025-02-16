// ex. scripts/build_npm.ts
import { build, emptyDir } from "@deno/dnt";
import denoJson from "../deno.json" with { type: "json" };

const outDir = "./.npm-dist";
await emptyDir(outDir);

await build({
	entryPoints: ["./src/mod.ts"],
	outDir,
	shims: {
		// see JS docs for overview and more options
		deno: true,
	},
    test: false,
    // Include a CommonJS or UMD module.
    scriptModule: false,
	package: {
		// package.json properties
		name: "@marianmeres/clog",
		version: denoJson.version, // Deno.args[0],
		description: "",
		license: "MIT",
		repository: {
			type: "git",
			url: "git+https://github.com/marianmeres/clog.git",
		},
		bugs: {
			url: "https://github.com/marianmeres/repo/issues",
		},
	},
	postBuild() {
		// steps to run after building and before running the tests
		Deno.copyFileSync("LICENSE", `${outDir}/LICENSE`);
		Deno.copyFileSync("README.md", `${outDir}/README.md`);
	},
});
