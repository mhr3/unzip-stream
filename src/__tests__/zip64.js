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

describe('zip64', () => {
  it('should parse zip64 archive', () => {
    const archive = path.join(__dirname, testDataDir, 'zip64/archive.zip');

    const unzipParser = new unzip.Parse();
    fs.createReadStream(archive).pipe(unzipParser);
    unzipParser.on('error', (err) => {
      throw err;
    });
  });

  it('extract zip64 archive', async () => {
    const archive = path.join(__dirname, testDataDir, 'zip64/archive.zip');
    const dirPath = await mkdir('node-unzip-');
    const unzipExtractor = new unzip.Extract({ path: dirPath });

    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiffCb(path.join(__dirname, testDataDir, 'zip64/inflated'), dirPath, {
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

  it('should parse archive w/ zip64 local file', () => {
    const archive = path.join(__dirname, testDataDir, 'zip64-dd/archive.zip');

    const unzipParser = new unzip.Parse();
    fs.createReadStream(archive).pipe(unzipParser);
    unzipParser.on('error', (err) => {
      throw err;
    });
  });

  it('should extract archive w/ zip64 local file', async () => {
    const archive = path.join(__dirname, testDataDir, 'zip64-dd/archive.zip');
    const dirPath = await mkdir('node-unzip-');
    const unzipExtractor = new unzip.Extract({ path: dirPath });

    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiffCb(path.join(__dirname, testDataDir, 'zip64-dd/inflated'), dirPath, {
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
