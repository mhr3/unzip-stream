const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const unzip = require('../');

test('parse archive w/ no signature', (t) => {
  const archive = path.join(__dirname, '../testData/invalid/archive.zip');

  const gotError = false;
  const unzipParser = new unzip.Parse();
  fs.createReadStream(archive).pipe(unzipParser);
  unzipParser.on('error', (err) => {
    if (err.message.indexOf('Not a valid') === -1) {
      throw new Error('Expected invalid archive error');
    }
    t.end();
  });

  unzipParser.on('close', () => {
    if (gotError) {
      return;
    }
    throw new Error('Expected an error');
  });
});
