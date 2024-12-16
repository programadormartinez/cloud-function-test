/*
This hook prepares the project for build or deploy phase depending on the environment.
*/

const Utils = require('./utils');

const run = async () => {
  if (!process.env.ENV) {
    console.warn('\x1b[33m%s\x1b[0m', `WARNING: No environment selected, default: dev. Use \'npm run build:ENVIRONMENT\' to ${flow} this project.`);
  }
  const environment = process.env.ENV || 'dev';
  // Copy initial environments files
  //Utils.copyFiles([
  //  {name: 'Environment files', src: `./environments/${environment}/src/environment-config.ts`, dst: './src'},
  //]);
};
run();
