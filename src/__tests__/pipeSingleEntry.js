const fs = require('fs');
const path = require('path');
const unzip = require('../../unzip');
const { Writable } = require('stream');

const testDataDir = '../../testData';

describe('pipe single entry', () => {
  it('should pipe a single file entry out of a zip', () => {
    const archive = path.join(__dirname, testDataDir, 'compressed-standard/archive.zip');
    let str = '';

    const writableStream = new Writable({
      write: (chunk, encoding, next) => {
        str += chunk.toString();
        next();
      }
    });

    fs.createReadStream(archive)
      .pipe(new unzip.Parse())
      .on('entry', (entry) => {
        if (entry.path === 'file.txt') {
          writableStream.on('close', () => {
            const fileStr = fs.readFileSync(path.join(__dirname, testDataDir, 'compressed-standard/inflated/file.txt'), 'utf8')
            expect(str).toBe(fileStr);
          });
          entry.pipe(writableStream);
        } else {
          entry.autodrain();
        }
      });
  });
});
