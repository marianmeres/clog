import fs from "node:fs";
import typescript from '@rollup/plugin-typescript';

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))

export default [
	// CommonJS (for Node) and ES module (for bundlers) build.
	// (We could have three entries in the configuration array
	// instead of two, but it's quicker to generate multiple
	// builds from a single configuration where possible, using
	// an array for the `output` option, where we can specify
	// `file` and `format` for each target)
	{
		input: 'src/index.ts',
		// external: ['lodash'],
		plugins: [
			typescript(), // so Rollup can convert TypeScript to JavaScript
			// terser()
		],
		output: [
			{ file: pkg.main, format: 'cjs' },
			{ file: pkg.module, format: 'es' }
		]
	}
];
