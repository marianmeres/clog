// deno-lint-ignore-file no-explicit-any

import { ensureDir, emptyDir, copySync, walkSync } from "@std/fs";
import { join } from "@std/path";
import denoJson from "../deno.json" with { type: "json" };

/**
 * This is quick-n-dirty npm package build script...
 */

const TS_TO_JS_REGEX =
	/from\s+(['"])([^'"]+)\.ts(['"]);?|import\s*\(\s*(['"])([^'"]+)\.ts(['"]),?\s*\)/g;

// prettier-ignore
function replaceWithJs(_match: any, q1: any, path1: any, q3: any, q4: any, path2: any, q6: any) {
	if (path1) {
		// Static import: from "path.ts"
		return `from ${q1}${path1}.js${q3}`;
	} else {
		// Dynamic import: import("path.ts")
		return `import(${q4}${path2}.js${q6})`;
	}
}

const srcDir = join(import.meta.dirname!, "../src");
const outDir = join(import.meta.dirname!, "../.npm-dist");
const outDirSrc = join(outDir, '/src');
const outDirDist = join(outDir, '/dist');

console.log({srcDir, outDir, outDirSrc, outDirDist});

await ensureDir(outDir);
await emptyDir(outDir);

// copy
copySync(srcDir, outDirSrc);
Deno.copyFileSync("LICENSE", join(outDir, "LICENSE"));
Deno.copyFileSync("README.md", join(outDir, "README.md"));

// create tsconfig.json
const tsconfigJson = {
	compilerOptions: {
		target: "esnext",
		module: "nodenext",
		strict: false,
		declaration: true,
		forceConsistentCasingInFileNames: true,
		skipLibCheck: true,
		rootDir: "src",
		outDir: "dist",
		moduleResolution: "nodenext",
		types: ["node"]
	},
};
Deno.writeTextFileSync(
	join(outDir, "tsconfig.json"),
	JSON.stringify(tsconfigJson, null, "\t")
);

// WTF hackery: Option 'allowImportingTsExtensions' can only be used when...
for (const f of walkSync(outDirSrc)) {
	if (f.isFile) {
		const contents = Deno.readTextFileSync(f.path);
		const replaced = contents.replace(TS_TO_JS_REGEX, replaceWithJs);
		Deno.writeTextFileSync(f.path, replaced);
	}
}

// create package json
const packageJson = {
	name: denoJson.name,
	version: denoJson.version,
	type: "module",
	main: "dist/mod.js",
	types: "dist/mod.d.ts",
	publishConfig: {
		registry: "https://dev.nettle.ai/registry"
	},
	devDependencies: {
		"@types/node": "latest",
	}
};
// "pg": "^8.16.2",
Deno.writeTextFileSync(
	join(outDir, "package.json"),
	JSON.stringify(packageJson, null, "\t")
);

Deno.chdir(outDir);

([
	["npm", { args: ["install"] }],
	["tsc", { args: ["-p", "tsconfig.json"] }],
] as [string, { args: string[]}][]).forEach(([cmd, opts]) => {
	console.log('--> Executing:', cmd, opts);
	const command = new Deno.Command(cmd, opts);
	let { code, stdout, stderr } = command.outputSync();
	stdout = new TextDecoder().decode(stdout) as any;
	stdout && console.log(stdout);
	if (code) throw new Error(new TextDecoder().decode(stderr));
});

// cleanup
['tsconfig.json'].forEach((f) => {
	Deno.removeSync(join(outDir, f))
});

Deno.removeSync(outDirSrc, { recursive: true });




// // deno-lint-ignore-file no-explicit-any
// import { ensureDir, emptyDir } from "@std/fs";
// import { join } from "@std/path";
// import denoJson from "../deno.json" with { type: "json" };

// /**
//  * This is quick-n-dirty npm package build script... as importing with `pnpm dlx jsr add @marianmeres/clog`
//  * has its limitation sometimes.
//  *
//  * This is a trivial one file source with no deps, so, it's easy...
//  */

// const inDir = "./src";
// const outDir = "./.npm-dist";

// await ensureDir(outDir);
// await emptyDir(outDir);

// // copy src
// Deno.copyFileSync(join(inDir, "clog.ts"), join(outDir, "index.ts"));
// Deno.copyFileSync("LICENSE", join(outDir, 'LICENSE'));
// Deno.copyFileSync("README.md", join(outDir, 'README.md'));

// // create tsconfig.json
// const tsconfigJson = {
// 	compilerOptions: {
// 		target: "esnext",
// 		module: "esnext",
// 		strict: false,
// 		declaration: true,
// 		forceConsistentCasingInFileNames: true,
// 		skipLibCheck: true,
// 	},
// };
// Deno.writeTextFileSync(
// 	join(outDir, "tsconfig.json"),
// 	JSON.stringify(tsconfigJson, null, "\t")
// );

// // compile tsc
// const command = new Deno.Command("tsc", {
// 	args: ["-p", join(outDir, "tsconfig.json")],
// });
// let { code, stdout, stderr } = command.outputSync();
// stdout = new TextDecoder().decode(stdout) as any;
// stdout && console.log(stdout);
// if (code) throw new Error(new TextDecoder().decode(stderr));

// // create package json
// const packageJson = {
// 	name: denoJson.name,
// 	version: denoJson.version,
// 	type: "module",
// 	main: "index.js",
// 	types: "index.d.ts",
// 	author: "Marian Meres",
// 	license: "MIT",
// 	repository: {
// 		type: "git",
// 		url: "git+https://github.com/marianmeres/clog.git",
// 	},
// 	bugs: {
// 		url: "https://github.com/marianmeres/clog/issues",
// 	},
// };
// Deno.writeTextFileSync(
// 	join(outDir, "package.json"),
// 	JSON.stringify(packageJson, null, "\t")
// );

// // cleanup
// ['index.ts', 'tsconfig.json'].forEach((f) => {
// 	Deno.removeSync(join(outDir, f))
// });