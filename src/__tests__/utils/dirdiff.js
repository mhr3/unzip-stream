/* eslint-disable consistent-return */
const { glob } = require('glob');
const path = require('path');
const fs = require('fs/promises');

// eslint-disable-next-line max-params
const diffFile = async (dir1, file1, dir2, file2) => {
  const file1Stat = await fs.stat(path.join(dir1, file1));
  const file2Stat = await fs.stat(path.join(dir2, file2));

  if (file1Stat.isDirectory() && file2Stat.isDirectory()) {
    return;
  }

  if ((file1Stat.isDirectory() && !file2Stat.isDirectory()) || (!file1Stat.isDirectory() && file2Stat.isDirectory())) {
    return {
      type: 'fileTypeMismatch',
      file1,
      file2,
    };
  }

  const file1Data = await fs.readFile(path.join(dir1, file1));
  const file2Data = await fs.readFile(path.join(dir2, file2));

  if (file1Data.length !== file2Data.length) {
    return {
      type: 'fileLengthMismatch',
      file1,
      file2,
    };
  }

  for (let i = 0; i < file1Data.length; i++) {
    if (file1Data[i] !== file2Data[i]) {
      return {
        type: 'fileContentMismatch',
        file1,
        file2,
        pos: i,
      };
    }
  }
};

// eslint-disable-next-line max-params
const diffFiles = async (dir1, dir1Files, dir2, dir2Files, opts) => {
  const dir1FilesSorted = dir1Files.sort();
  const dir2FilesSorted = dir2Files.sort();

  const results = [];
  let dir1Idx = 0;
  let dir2Idx = 0;

  while (!(dir1Idx >= dir1FilesSorted.length && dir2Idx >= dir2FilesSorted.length)) {
    if (
      dir1Idx < dir1FilesSorted.length &&
      dir2Idx < dir2FilesSorted.length &&
      dir1FilesSorted[dir1Idx] === dir2FilesSorted[dir2Idx]
    ) {
      if (opts.fileContents) {
        // eslint-disable-next-line no-await-in-loop
        const diff = await diffFile(dir1, dir1FilesSorted[dir1Idx], dir2, dir2FilesSorted[dir2Idx], opts);

        if (diff) {
          results.push(diff);
        }
        dir1Idx += 1;
        dir2Idx += 1;
      } else {
        dir1Idx += 1;
        dir2Idx += 1;
      }
    } else if (dir2Idx >= dir2FilesSorted.length || dir1FilesSorted[dir1Idx] < dir2FilesSorted[dir2Idx]) {
      results.push({
        type: 'fileMissing',
        file1: dir1FilesSorted[dir1Idx],
        file2: null,
      });
      dir1Idx += 1;
    } else {
      results.push({
        type: 'fileMissing',
        file1: null,
        file2: dir2FilesSorted[dir2Idx],
      });
      dir2Idx += 1;
    }
  }

  return results;
};

const dirdiff = async (dir1, dir2, opts) => {
  let dir1Files = await glob('**', { cwd: dir1 });
  let dir2Files = await glob('**', { cwd: dir2 });

  dir1Files = dir1Files.filter((f) => {
    return !!f;
  });
  dir2Files = dir2Files.filter((f) => {
    return !!f;
  });

  return diffFiles(dir1, dir1Files, dir2, dir2Files, opts);
};

module.exports = dirdiff;
module.exports.diffFiles = diffFiles;
module.exports.diffFile = diffFile;
