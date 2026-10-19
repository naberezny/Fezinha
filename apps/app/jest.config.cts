module.exports = {
  displayName: 'app',
  preset: '../../jest.preset.js',
  setupFilesAfterEnv: ['<rootDir>/src/test-setup.ts'],
  coverageDirectory: '../../coverage/apps/app',
  transform: {
    '^.+\\.(ts|mjs|js|html)$': [
      'jest-preset-angular',
      {
        tsconfig: '<rootDir>/tsconfig.spec.json',
        stringifyContentPathRegex: '\\.(html|svg)$',
      },
    ],
  },
  // Ionic/Stencil/ionicons publicam ESM em .js; com pnpm o caminho passa por node_modules/.pnpm/.
  transformIgnorePatterns: [
    'node_modules/(?!(\\.pnpm/|.*\\.mjs$|@ionic/|@stencil/|ionicons/))',
  ],
  snapshotSerializers: [
    'jest-preset-angular/build/serializers/no-ng-attributes',
    'jest-preset-angular/build/serializers/ng-snapshot',
    'jest-preset-angular/build/serializers/html-comment',
  ],
};
