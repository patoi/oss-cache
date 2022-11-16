/**
 * JavaScript (ESM) - use .eslintrc.cjs when running ESLint in JavaScript packages that specify
 * "type":"module" in their package.json. Note that ESLint does not support ESM configuration at this time.
 */
module.exports = {
  root: true,
  extends: ['eslint:recommended', 'prettier'],
  parserOptions: {
    sourceType: 'module',
    ecmaVersion: 2022
  },
  env: {
    browser: false,
    mocha: true,
    node: true,
    es2022: true
  },
  rules: {
    'no-shadow': ['error'],
    'no-unused-vars': ['error', { ignoreRestSiblings: true }]
  }
}
