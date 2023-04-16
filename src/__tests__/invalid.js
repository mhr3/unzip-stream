const fs = require('fs');
const path = require('path');
const unzip = require('../../unzip');

const testDataDir = '../../testData';

describe('invalid', () => {
  it('should parse archive w/ no signature', () => {
    const archive = path.join(__dirname, testDataDir, 'invalid/archive.zip');

    const gotError = false;
    const unzipParser = new unzip.Parse();
    fs.createReadStream(archive).pipe(unzipParser);
    unzipParser.on('error', (err) => {
      if (err.message.indexOf('Not a valid') === -1) {
        throw new Error('Expected invalid archive error');
      }
    });

    unzipParser.on('close', () => {
      if (gotError) {
        return;
      }
      throw new Error('Expected an error');
    });
  });
});
