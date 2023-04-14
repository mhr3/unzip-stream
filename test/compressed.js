const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const temp = require('temp');
const dirdiff = require('dirdiff');
const unzip = require('../');

test('parse compressed archive (created by POSIX zip)', (t) => {
  const archive = path.join(__dirname, '../testData/compressed-standard/archive.zip');

  const unzipParser = new unzip.Parse();
  fs.createReadStream(archive).pipe(unzipParser);
  unzipParser.on('error', (err) => {
    throw err;
  });

  unzipParser.on('close', t.end.bind(this));
});

test('extract compressed archive w/ file sizes known prior to zlib inflation (created by POSIX zip)', (t) => {
  const archive = path.join(__dirname, '../testData/compressed-standard/archive.zip');

  temp.mkdir('node-unzip-', (err, dirPath) => {
    if (err) {
      throw err;
    }
    const unzipExtractor = new unzip.Extract({ path: dirPath });
    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiff(path.join(__dirname, '../testData/compressed-standard/inflated'), dirPath, {
        fileContents: true
      }, (err, diffs) => {
        if (err) {
          throw err;
        }
        t.equal(diffs.length, 0, 'extracted directory contents');
        t.end();
      });
    });

    fs.createReadStream(archive).pipe(unzipExtractor);
  });
});
