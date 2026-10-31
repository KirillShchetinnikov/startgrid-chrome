import js from '@eslint/js';
import stylistic from '@stylistic/eslint-plugin';
import globals from 'globals';

export default [
  { ignores: ['extension/**', 'extension_chrome/**', '**/*.config.js'] },
  {
    files: ['src/js/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node, chrome: 'writable', browser: 'writable' }
    },
    plugins: { '@stylistic': stylistic },
    rules: {
      ...js.configs.recommended.rules,
      "strict": 0,
      "@stylistic/indent": [
        "error",
        2,
        {
          "SwitchCase": 1,
          "ignoredNodes": [
            "TemplateLiteral > *"
          ]
        }
      ],
      "@stylistic/linebreak-style": [
        "error",
        "unix"
      ],
      "@stylistic/quotes": [
        "error",
        "single",
        {
          "allowTemplateLiterals": "always"
        }
      ],
      "@stylistic/semi": [
        "error",
        "always"
      ],
      "no-console": [
        "error",
        {
          "allow": [
            "warn",
            "error"
          ]
        }
      ],
      "no-empty-function": "error",
      "@stylistic/brace-style": "error",
      "@stylistic/spaced-comment": "error",
      "no-empty": [
        "error",
        {
          "allowEmptyCatch": true
        }
      ],
      "@stylistic/max-len": [
        "error",
        {
          "code": 120,
          "ignoreComments": true,
          "ignoreTemplateLiterals": true,
          "ignoreRegExpLiterals": true
        }
      ],
      "@stylistic/eol-last": "error",
      "no-useless-escape": "off",
      "@stylistic/block-spacing": "error",
      "@stylistic/array-bracket-spacing": "error",
      "@stylistic/computed-property-spacing": "error",
      "@stylistic/function-call-spacing": "error",
      "@stylistic/keyword-spacing": "error",
      "@stylistic/semi-spacing": "error",
      "@stylistic/comma-spacing": "error",
      "@stylistic/space-before-function-paren": [
        "error",
        { anonymous: "never", named: "never", asyncArrow: "never", catch: "always" }
      ],
      "@stylistic/space-in-parens": "error",
      "@stylistic/space-unary-ops": [
        2,
        {
          "words": true,
          "nonwords": false
        }
      ],
      "@stylistic/space-infix-ops": [
        "error",
        {
          "int32Hint": false
        }
      ],
      "@stylistic/arrow-spacing": "error",
      "no-var": "error",
      "no-duplicate-imports": "error",
      "no-unneeded-ternary": "error",
      "@stylistic/object-curly-spacing": [
        "error",
        "always"
      ],
      "@stylistic/key-spacing": [
        "error",
        {
          "afterColon": true
        }
      ],
      "@stylistic/comma-dangle": [
        "error",
        "never"
      ],
      "@stylistic/padded-blocks": [
        "error",
        "never"
      ],
      "require-await": "error",
      "@stylistic/no-multiple-empty-lines": [
        "error",
        {
          "max": 1,
          "maxBOF": 0,
          "maxEOF": 0
        }
      ],
      "no-unused-vars": [
        "error",
        {
          "caughtErrors": "none"
        }
      ]
    }
  }
];
