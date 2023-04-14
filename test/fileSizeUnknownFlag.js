const test = require('tap').test;
const fs = require('fs');
const path = require('path');
const temp = require('temp');
const dirdiff = require('dirdiff');
const unzip = require('../');

test('parse archive w/ file size unknown flag set (created by OS X Finder)', (t) => {
  const archive = path.join(__dirname, '../testData/compressed-OSX-Finder/archive.zip');

  const unzipParser = new unzip.Parse();
  fs.createReadStream(archive).pipe(unzipParser);
  unzipParser.on('error', (err) => {
    throw err;
  });

  unzipParser.on('close', t.end.bind(this));
});

test('extract archive w/ file size unknown flag set (created by OS X Finder)', (t) => {
  const archive = path.join(__dirname, '../testData/compressed-OSX-Finder/archive.zip');

  temp.mkdir('node-unzip-', (err, dirPath) => {
    if (err) {
      throw err;
    }
    const unzipExtractor = new unzip.Extract({ path: dirPath });
    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiff(path.join(__dirname, '../testData/compressed-OSX-Finder/inflated'), dirPath, {
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

test('archive w/ language encoding flag set', (t) => {
  const archive = path.join(__dirname, '../testData/compressed-flags-set/archive.zip');

  temp.mkdir('node-unzip-', (err, dirPath) => {
    if (err) {
      throw err;
    }
    const unzipExtractor = new unzip.Extract({ path: dirPath });
    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiff(path.join(__dirname, '../testData/compressed-flags-set/inflated'), dirPath, {
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
