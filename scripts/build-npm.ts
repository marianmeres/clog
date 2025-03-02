// deno-lint-ignore-file no-explicit-any
import { ensureDir, emptyDir } from "@std/fs";
import { join } from "@std/path";
import denoJson from "../deno.json" with { type: "json" };

/**
 * This is quick-n-dirty npm package build script... as importing with `pnpm dlx jsr add @marianmeres/clog`
 * has its limitation sometimes.
 *
 * This is a trivial one file source with no deps, so, it's easy...
 */

const inDir = "./src";
const outDir = "./.npm-dist";

await ensureDir(outDir);
await emptyDir(outDir);

// copy src
Deno.copyFileSync(join(inDir, "clog.ts"), join(outDir, "index.ts"));
Deno.copyFileSync("LICENSE", join(outDir, 'LICENSE'));
Deno.copyFileSync("README.md", join(outDir, 'README.md'));

// create tsconfig.json
const tsconfigJson = {
	compilerOptions: {
		target: "esnext",
		module: "esnext",
		strict: false,
		declaration: true,
		forceConsistentCasingInFileNames: true,
		skipLibCheck: true,
	},
};
Deno.writeTextFileSync(
	join(outDir, "tsconfig.json"),
	JSON.stringify(tsconfigJson, null, "\t")
);

// compile tsc
const command = new Deno.Command("tsc", {
	args: ["-p", join(outDir, "tsconfig.json")],
});
let { code, stdout, stderr } = command.outputSync();
stdout = new TextDecoder().decode(stdout) as any;
stdout && console.log(stdout);
if (code) throw new Error(new TextDecoder().decode(stderr));

// create package json
const packageJson = {
	name: denoJson.name,
	version: denoJson.version,
	type: "module",
	main: "index.js",
	types: "index.d.ts",
	author: "Marian Meres",
	license: "MIT",
	repository: {
		type: "git",
		url: "git+https://github.com/marianmeres/clog.git",
	},
	bugs: {
		url: "https://github.com/marianmeres/repo/issues",
	},
};
Deno.writeTextFileSync(
	join(outDir, "package.json"),
	JSON.stringify(packageJson, null, "\t")
);

// cleanup
['index.ts', 'tsconfig.json'].forEach((f) => {
	Deno.removeSync(join(outDir, f))
});