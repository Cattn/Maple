const svelte = require('eslint-plugin-svelte');
const ts = require('@typescript-eslint/eslint-plugin');
const tsParser = require('@typescript-eslint/parser');

module.exports = [
	{
		ignores: [
			'.DS_Store',
			'node_modules',
			'api/dist',
			'build',
			'.svelte-kit',
			'package',
			'.env',
			'.env.*',
			'pnpm-lock.yaml',
			'package-lock.json',
			'yarn.lock'
		]
	},
	...svelte.configs['flat/recommended'],
	{
		files: ['**/*.svelte'],
		languageOptions: {
			parserOptions: {
				parser: tsParser,
				extraFileExtensions: ['.svelte'],
				sourceType: 'module'
			}
		}
	},
	{
		files: ['**/*.ts'],
		languageOptions: {
			parser: tsParser,
			parserOptions: {
				sourceType: 'module'
			}
		},
		plugins: {
			'@typescript-eslint': ts
		},
		rules: {
			...ts.configs.recommended.rules
		}
	}
];
