# unzip-stream

Streaming cross-platform unzip tool written in node.js.

This package is based on [unzip](https://github.com/EvanOxfeld/node-unzip) (and its fork [unzipper](https://github.com/ZJONSSON/node-unzipper)) and provides simple APIs for parsing and extracting zip files. It uses new streaming engine which allows it to process also files which would fail with unzip.
There are no added compiled dependencies - inflation is handled by node.js's built in zlib support.

Please note that the zip file format isn't really meant to be processed by streaming, though this library should succeed in most cases, if you do have complete zip file available, you should consider using other libraries which read zip files from the end - as originally intended (for example [yauzl](https://github.com/thejoshwolfe/yauzl) or [decompress-zip](https://github.com/bower/decompress-zip)).

## Installation

```bash
> npm install @instamotion/unzip-stream
```

## Quick Examples

### Parse zip file contents

Process each zip file entry or pipe entries to another stream.

__Important__: If you do not intend to consume an entry stream's raw data, call autodrain() to dispose of the entry's
contents. Otherwise the stream will get stuck.

```javascript
const fs = require('fs');
const unzip = require('@instamotion/unzip');

fs.createReadStream('path/to/archive.zip')
  .pipe(new unzip.Parse())
  .on('entry', (entry) => {
    const { path: filePath, type, size } = entry;
    if (filePath === `this IS the file I'm looking for`) {
      entry.pipe(fs.createWriteStream('output/path'));
    } else {
      entry.autodrain();
    }
  });
```

### Parse zip by piping entries downstream

If you `pipe` from unzip-stream the downstream components will receive each `entry` for further processing.   This allows for clean pipelines transforming zipfiles into unzipped data.

Example using `stream.Transform`:

```javascript
const fs = require('fs');
const stream = require('stream');
const unzip = require('@instamotion/unzip');

fs.createReadStream('path/to/archive.zip')
  .pipe(new unzip.Parse())
  .pipe(stream.Transform({
    objectMode: true,
    transform: (entry, e, cb) => {
      const { path: filePath, type, size } = entry;

      if (filePath === `this IS the file I'm looking for`) {
        entry.pipe(fs.createWriteStream('output/path'))
          .on('finish', cb);
      } else {
        entry.autodrain();
        cb();
      }
    }
  }
  }));
```

### Extract to a directory

```javascript
const fs = require('fs');
const unzip = require('@instamotion/unzip');

fs.createReadStream('path/to/archive.zip').pipe(
  new unzip.Extract({ path: 'output/path' })
);
```

Extract will emit the 'close' event when the archive is fully extracted, do NOT use the 'finish' event, which can be emitted before the writing finishes.

### Extra options

The `Parse` and `Extract` methods allow passing an object with `decodeString` property which will be used to decode non-utf8 file names in the archive. If not specified a fallback will be used.

Example with `iconv-lite`:

```javascript
const unzip = require('@instamotion/unzip');
const iconvLite = require('iconv-lite');

let parser = new unzip.Parse({
  decodeString: (buffer) => {
    return iconvLite.decode(buffer, 'iso-8859-2');
  }
});
input.pipe(parser).pipe(...);
```

### What's missing?

Currently ZIP files up to version 4.5 are supported (which includes Zip64 support - archives with 4GB+ files). There's no support for encrypted (password protected) zips, or symlinks.
