module.exports = {
  overrides: [
    {
      files: ['cli.ts'],
      rules: {
        'no-console': 'off',
        'no-case-declarations': 'off',
        'github/array-foreach': 'off',
        '@typescript-eslint/explicit-function-return-type': 'off'
      }
    }
  ]
}