const fs = require('fs');
const path = require('path');
const temp = require('temp');
const { promisify } = require('util');
const { callbackify } = require('util');
const dirdiff = require('./utils/dirdiff');
const unzip = require('../../unzip');

const mkdir = promisify(temp.mkdir);
const dirdiffCb = callbackify(dirdiff);
const testDataDir = '../../testData';

describe('uncompressed', () => {
  it('should parse uncompressed archive', () => {
    const archive = path.join(__dirname, testDataDir, 'uncompressed/archive.zip');

    const unzipParser = new unzip.Parse();
    fs.createReadStream(archive).pipe(unzipParser);
    unzipParser.on('error', (err) => {
      throw err;
    });
  });

  it('should extract uncompressed archive', async () => {
    const archive = path.join(__dirname, testDataDir, 'uncompressed/archive.zip');
    const dirPath = await mkdir('node-unzip-');
    const unzipExtractor = new unzip.Extract({ path: dirPath });

    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiffCb(
        path.join(__dirname, testDataDir, 'uncompressed/inflated'),
        dirPath,
        {
          fileContents: true,
        },
        (err, diffs) => {
          if (err) {
            throw err;
          }
          expect(diffs.length).toEqual(0);
        }
      );
    });

    fs.createReadStream(archive).pipe(unzipExtractor);
  });
});
