module.exports = {
  root: true,
  extends: ['@instamotion/backend'],
  rules: {
    '@typescript-eslint/no-var-requires': 'off',
    'import/no-extraneous-dependencies': 'off',
  },
  ignorePatterns: ['src/**/*.ts', 'jest.config.js'],
};
