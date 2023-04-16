const { glob } = require('glob');
const path = require('path');
const fs = require('fs/promises');

const dirdiff = module.exports = async (dir1, dir2, opts) => {
  let dir1Files = await glob('**', { cwd: dir1 });
  let dir2Files = await glob('**', { cwd: dir2 });

  dir1Files = dir1Files
    .filter((f) => { return !!f; });
  dir2Files = dir2Files
    .filter((f) => { return !!f; });

  return diffFiles(dir1, dir1Files, dir2, dir2Files, opts);
};

const diffFiles = dirdiff.diffFiles = async (dir1, dir1Files, dir2, dir2Files, opts) => {
  dir1Files = dir1Files.sort();
  dir2Files = dir2Files.sort();

  const results = [];
  let dir1Idx = 0;
  let dir2Idx = 0;

  while (!(dir1Idx >= dir1Files.length && dir2Idx >= dir2Files.length)) {
    if (dir1Idx < dir1Files.length && dir2Idx < dir2Files.length && dir1Files[dir1Idx] === dir2Files[dir2Idx]) {
      if (opts.fileContents) {
        const diff = await diffFile(dir1, dir1Files[dir1Idx], dir2, dir2Files[dir2Idx], opts);

        if (diff) {
          results.push(diff);
        }
        dir1Idx++;
        dir2Idx++;
      } else {
        dir1Idx++;
        dir2Idx++;
      }
    } else if (dir2Idx >= dir2Files.length || dir1Files[dir1Idx] < dir2Files[dir2Idx]) {
      results.push({
        type: 'fileMissing',
        file1: dir1Files[dir1Idx],
        file2: null
      });
      dir1Idx++;
    } else {
      results.push({
        type: 'fileMissing',
        file1: null,
        file2: dir2Files[dir2Idx]
      });
      dir2Idx++;
    }
  }

  return results;
};

const diffFile = dirdiff.diffFile = async (dir1, file1, dir2, file2, opts) => {
  const file1Stat = await fs.stat(path.join(dir1, file1));
  const file2Stat = await fs.stat(path.join(dir2, file2));

  if (file1Stat.isDirectory() && file2Stat.isDirectory()) {
    return;
  }
  if ((file1Stat.isDirectory() && !file2Stat.isDirectory()) || (!file1Stat.isDirectory() && file2Stat.isDirectory())) {
    return {
      type: 'fileTypeMismatch',
      file1: file1,
      file2: file2
    };
  }


  const file1Data = await fs.readFile(path.join(dir1, file1));
  const file2Data = await fs.readFile(path.join(dir2, file2));

  if (file1Data.length !== file2Data.length) {
    return {
      type: 'fileLengthMismatch',
      file1: file1,
      file2: file2
    };
  }

  for (let i = 0; i < file1Data.length; i++) {
    if (file1Data[i] !== file2Data[i]) {
      return {
        type: 'fileContentMismatch',
        file1: file1,
        file2: file2,
        pos: i
      };
    }
  }

  return;
};

module.exports = dirdiff;
