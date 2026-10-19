import nx from '@nx/eslint-plugin';

export default [
  ...nx.configs['flat/base'],
  ...nx.configs['flat/typescript'],
  ...nx.configs['flat/javascript'],
  {
    ignores: ['**/dist', '**/out-tsc'],
  },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          enforceBuildableLibDependency: true,
          allow: ['^.*/eslint(\\.base)?\\.config\\.[cm]?[jt]s$'],
          // Fronteiras do workspace (docs/01-especificacao.md, seção 3).
          depConstraints: [
            { sourceTag: 'scope:core', onlyDependOnLibsWithTags: ['scope:core'] },
            {
              sourceTag: 'scope:loteria',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:loteria'],
            },
            {
              sourceTag: 'scope:contratos',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:contratos'],
            },
            {
              sourceTag: 'scope:ui',
              onlyDependOnLibsWithTags: ['scope:core', 'scope:ui'],
            },
            {
              sourceTag: 'scope:app',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:ui',
                'scope:contratos',
                'scope:loteria',
                'scope:app',
              ],
            },
            {
              sourceTag: 'scope:api',
              onlyDependOnLibsWithTags: [
                'scope:core',
                'scope:contratos',
                'scope:loteria',
                'scope:api',
              ],
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      '**/*.ts',
      '**/*.tsx',
      '**/*.cts',
      '**/*.mts',
      '**/*.js',
      '**/*.jsx',
      '**/*.cjs',
      '**/*.mjs',
    ],
    // Override or add rules here
    rules: {},
  },
];
