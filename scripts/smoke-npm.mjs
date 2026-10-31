/**
 * Smoke-tests the built npm package (`pnpm run smoke`, or
 * `node scripts/smoke-npm.mjs` after `pnpm run build`).
 *
 * `pnpm pack`s the repo root - the tarball `pnpm publish` would upload - and in
 * a throw-away project under the OS temp dir installs it with npm, as a
 * consumer gets it, then on Node:
 *
 *  1. checks the installed package.json (the three `exports` keys and their
 *     files, no runtime dependencies, `@marianmeres/batch` an optional peer,
 *     `engines.node`) and that the tarball carries `dist/` and none of the
 *     repo-only directories;
 *  2. **without batch installed**, imports `.` and checks stacktrace mode: the
 *     suite runs `src/*.ts`, so only here does clog run from `dist/*.js`, and
 *     its own frames must still be dropped;
 *  3. installs batch (the range of the package's optional peer), then imports
 *     `./forward` and `./web`, which need it.
 *
 * Repo tool, Node only (nothing here is shipped).
 */

import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const PKG = "@marianmeres/clog";
const BATCH = "@marianmeres/batch";

const EXPECTED_EXPORTS = [".", "./forward", "./web"];
/** Repo directories the published tarball must not carry. */
const REPO_ONLY = ["src", "tests", "scripts", "examples", "tmp", "node_modules"];

/** Step 2: runs before batch is installed. */
const CORE = `
import assert from "node:assert/strict";
import { createClog, withNamespace } from "${PKG}";

const stacks = [];
createClog.global.writer = (data) => stacks.push(data.stack);
createClog.global.stacktrace = true;

const clog = createClog("smoke");
clog("callable");
clog.debug("debug");
clog.log("log");
clog.warn("warn");
clog.error("error");
withNamespace(clog, "child").log("child");

assert.equal(stacks.length, 6, "one stack per log call");
for (const stack of stacks) {
	assert.ok(
		stack?.[0]?.includes(import.meta.url),
		\`the first frame is not the log call's:\\n\${stack?.join("\\n")}\`,
	);
}
console.log("smoke: . imports without batch; stack frames start at the log call");
`;

/** Step 3: runs after batch is installed. */
const SUBPATHS = `
import assert from "node:assert/strict";
import { createLogForwarder } from "${PKG}/forward";
import { configureWebLogger, getOrCreateAgentId } from "${PKG}/web";

assert.equal(typeof createLogForwarder, "function", "createLogForwarder");
assert.equal(typeof configureWebLogger, "function", "configureWebLogger");
assert.equal(typeof getOrCreateAgentId, "function", "getOrCreateAgentId");
console.log("smoke: ./forward and ./web import");
`;

function run(cmd, args, cwd) {
	console.log(`smoke: $ ${[cmd, ...args].join(" ")}`);
	execFileSync(cmd, args, { cwd, stdio: "inherit" });
}

function check(condition, what) {
	if (!condition) throw new Error(`smoke: ${what}`);
}

function checkInstalledManifest(dir) {
	const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
	check(pkg.name === PKG, `installed package is "${pkg.name}", expected "${PKG}"`);
	const exportKeys = Object.keys(pkg.exports ?? {}).sort();
	check(
		JSON.stringify(exportKeys) === JSON.stringify(EXPECTED_EXPORTS),
		`exports keys are ${JSON.stringify(exportKeys)}`,
	);
	for (const [key, entry] of Object.entries(pkg.exports)) {
		for (const kind of ["types", "default"]) {
			check(
				typeof entry[kind] === "string" && existsSync(join(dir, entry[kind])),
				`exports["${key}"].${kind} does not exist: ${entry?.[kind]}`,
			);
		}
	}
	check(!pkg.dependencies, `runtime dependencies: ${JSON.stringify(pkg.dependencies)}`);
	check(typeof pkg.peerDependencies?.[BATCH] === "string", `${BATCH} is not a peer`);
	check(
		pkg.peerDependenciesMeta?.[BATCH]?.optional === true,
		`${BATCH} peer is not optional`,
	);
	check(typeof pkg.engines?.node === "string", "engines.node missing");
	for (const name of REPO_ONLY) {
		check(!existsSync(join(dir, name)), `the tarball carries "${name}/"`);
	}
	console.log(
		`smoke: ${pkg.name}@${pkg.version} - exports ${exportKeys.length}, ` +
			`peer ${BATCH} ${pkg.peerDependencies[BATCH]} (optional), ` +
			`engines.node ${pkg.engines.node}`,
	);
	return pkg.peerDependencies[BATCH];
}

check(
	existsSync(join(ROOT, "dist", "mod.js")),
	"dist/mod.js is missing - run `pnpm run build` first",
);

const npmInstall = ["install", "--no-audit", "--no-fund", "--loglevel=error"];

const project = mkdtempSync(join(tmpdir(), "clog-npm-smoke-"));
try {
	writeFileSync(
		join(project, "package.json"),
		JSON.stringify(
			{ name: "clog-npm-smoke", private: true, type: "module" },
			null,
			"\t",
		),
	);
	const packDir = join(project, "pack");
	mkdirSync(packDir);
	run("pnpm", ["pack", "--pack-destination", packDir], ROOT);
	const tarballs = readdirSync(packDir).filter((f) => f.endsWith(".tgz"));
	check(tarballs.length === 1, `expected one tarball, got ${JSON.stringify(tarballs)}`);

	// the package alone: an optional peer is not installed, so no batch may appear
	run("npm", [...npmInstall, join(packDir, tarballs[0])], project);
	const batchRange = checkInstalledManifest(join(project, "node_modules", PKG));
	check(!existsSync(join(project, "node_modules", BATCH)), `${BATCH} got installed`);
	writeFileSync(join(project, "core.mjs"), CORE);
	run(process.execPath, ["core.mjs"], project);

	// then batch at the peer range, as whoever imports `./forward` installs it
	run("npm", [...npmInstall, `${BATCH}@${batchRange}`], project);
	writeFileSync(join(project, "subpaths.mjs"), SUBPATHS);
	run(process.execPath, ["subpaths.mjs"], project);
	console.log("smoke: OK");
} finally {
	rmSync(project, { recursive: true, force: true });
}
