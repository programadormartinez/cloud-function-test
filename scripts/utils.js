/*
  This script contains util functions
*/
const fs = require('fs-extra');

module.exports = {
  copyFiles: function (files) {
    console.info('Copying files...');
    try {
      files.forEach(file => {
        fs.copySync(file.src, file.dst);
        console.log(`${file.name} copied to destination.`);
      });
    } catch (exception) {
      this.handleError(exception);
    }
    console.info('Files copied!');
  },
  handleError: function (message) {
    console.error(message);
    process.exit(1);
  },
};
