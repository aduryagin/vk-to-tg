module.exports = {
    "extends": [
        "airbnb-base",
        "plugin:prettier/recommended"
    ],
    "plugins": [
        "prettier"
    ],
    "rules": {
        "prettier/prettier": ["error", {
            "singleQuote": true,
            "trailingComma": true
        }],
        "import/extensions": ["error", "always", {
            "js": "never",
            "mjs": "never",
            "json": "never",
        }],
        "no-console": 0,
        "no-new": 0,
        "no-empty": 0,
        "class-methods-use-this": 0,
        "no-nested-ternary": 0
    },
    "settings": {
        "import/resolver": {
          "node": {
            "extensions": [
              ".mjs",
              ".js",
              ".json"
            ]
          }
        }
    },
};