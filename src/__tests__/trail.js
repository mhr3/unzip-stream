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

describe('trail', () => {
  it('should parse archive w/ trailing data', () => {
    const archive = path.join(__dirname, testDataDir, 'trail/archive.zip');

    const unzipParser = new unzip.Parse();
    fs.createReadStream(archive).pipe(unzipParser);
    unzipParser.on('error', (err) => {
      throw err;
    });
  });

  it('should extract archive w/ trailing data', async () => {
    const archive = path.join(__dirname, testDataDir, 'trail/archive.zip');
    const dirPath = await mkdir('node-unzip-');
    const unzipExtractor = new unzip.Extract({ path: dirPath });

    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiffCb(
        path.join(__dirname, testDataDir, 'trail/inflated'),
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
