module.exports = {
  "env": {
    "node": true,
  },
  "extends": [
    "eslint:recommended",
    "prettier",
  ],
  "parserOptions": {
    "ecmaVersion": 9,
    "sourceType": "script",
  },
  "rules": {
    "indent": [
      "error",
      2,
    ],
    "linebreak-style": [
      "error",
      "unix",
    ],
    "quotes": [
      "error",
      "double",
    ],
    "semi": [
      "error",
      "always",
    ],
    "comma-dangle": ["error", "always-multiline"],
    "no-multiple-empty-lines": "error",
    "array-bracket-newline": ["error", "consistent"],
    "no-eval": "error",
  },
};
