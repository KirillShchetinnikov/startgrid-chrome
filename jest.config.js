const path = require('path');

module.exports = {
  verbose: true,
  rootDir: 'e2e',
  testTimeout: 60000,
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: path.resolve(__dirname, '.babelrc') }]
  }
};
