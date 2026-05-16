import { npmBuild, versionizeDeps } from "@marianmeres/npmbuild";

const denoJson = JSON.parse(Deno.readTextFileSync("deno.json"));

await npmBuild({
	name: denoJson.name,
	version: denoJson.version,
	repository: denoJson.name.replace(/^@/, ""),
	peerDependencies: versionizeDeps(["@marianmeres/batch"], denoJson),
	peerDependenciesMeta: {
		"@marianmeres/batch": { optional: true },
	},
	entryPoints: ["mod", "forward", "web"],
});
