//  @ts-check

import { tanstackConfig } from '@tanstack/eslint-config';

import rootConfig from '../../eslint.config.js';

export default [
	...rootConfig,
	...tanstackConfig,
	{
		rules: {
			'simple-import-sort/imports': 'off',
			'simple-import-sort/exports': 'off',
			'sort-imports': ['error', { ignoreDeclarationSort: true, ignoreMemberSort: true }],
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},
];
