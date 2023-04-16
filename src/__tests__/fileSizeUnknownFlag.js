const fs = require('fs');
const path = require('path');
const temp = require('temp');
const promisify = require('util').promisify;
const callbackify = require('util').callbackify;
const dirdiff = require('./utils/dirdiff');
const unzip = require('../../unzip');

const mkdir = promisify(temp.mkdir);
const dirdiffCb = callbackify(dirdiff);
const testDataDir = '../../testData';

describe('file size unknown flag', () => {
  it('should parse archive w/ file size unknown flag set (created by OS X Finder)', () => {
    const archive = path.join(__dirname, testDataDir, 'compressed-OSX-Finder/archive.zip');

    const unzipParser = new unzip.Parse();
    fs.createReadStream(archive).pipe(unzipParser);
    unzipParser.on('error', (err) => {
      throw err;
    });
  });

  it('should extract archive w/ file size unknown flag set (created by OS X Finder)', async () => {
    const archive = path.join(__dirname, testDataDir, 'compressed-OSX-Finder/archive.zip');
    const dirPath = await mkdir('node-unzip-');
    const unzipExtractor = new unzip.Extract({ path: dirPath });

    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiffCb(path.join(__dirname, testDataDir, 'compressed-OSX-Finder/inflated'), dirPath, {
        fileContents: true
      }, (err, diffs) => {;
        if (err) {
          throw err;
        }
        expect(diffs.length).toEqual(0);
      });
    });

    fs.createReadStream(archive).pipe(unzipExtractor);
  });

  it('should archive w/ language encoding flag set', async () => {
    const archive = path.join(__dirname, testDataDir, 'compressed-flags-set/archive.zip');
    const dirPath = await mkdir('node-unzip-');
    const unzipExtractor = new unzip.Extract({ path: dirPath });

    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiffCb(path.join(__dirname, testDataDir, 'compressed-flags-set/inflated'), dirPath, {
        fileContents: true
      }, (err, diffs) => {
        if (err) {
          throw err;
        }
        expect(diffs.length).toEqual(0);
      });
    });

    fs.createReadStream(archive).pipe(unzipExtractor);
  });
});
