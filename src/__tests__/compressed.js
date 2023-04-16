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

describe('compressed', () => {
  it('should parse compressed archive (created by POSIX zip)', () => {
    const archive = path.join(__dirname, testDataDir, 'compressed-standard/archive.zip');

    const unzipParser = new unzip.Parse();
    fs.createReadStream(archive).pipe(unzipParser);
    unzipParser.on('error', (err) => {
      throw err;
    });
  });

  it('should extract compressed archive w/ file sizes known prior to zlib inflation (created by POSIX zip)', async () => {
    const archive = path.join(__dirname, testDataDir, 'compressed-standard/archive.zip');
    const dirPath = await mkdir('node-unzip-');
    const unzipExtractor = new unzip.Extract({ path: dirPath });
    unzipExtractor.on('error', (err) => {
      throw err;
    });
    unzipExtractor.on('close', () => {
      dirdiffCb(path.join(__dirname, testDataDir, 'compressed-standard/inflated'), dirPath, {
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
