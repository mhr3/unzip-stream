/* eslint-disable no-underscore-dangle */
const fs = require('fs');
const path = require('path');
const { mkdirp } = require('mkdirp');
const { Transform } = require('stream');
const UnzipStream = require('./unzip-stream');

class Extract extends Transform {
  constructor(opts) {
    super();
    if (!(this instanceof Extract)) {
      // eslint-disable-next-line no-constructor-return
      return new Extract(opts);
    }

    this.opts = opts || {};
    this.unzipStream = new UnzipStream(this.opts);
    this.unfinishedEntries = 0;
    this.afterFlushWait = false;
    this.createdDirectories = {};

    this.unzipStream.on('entry', this._processEntry.bind(this));
    this.unzipStream.on('error', (error) => {
      this.emit('error', error);
    });
  }

  _transform(chunk, encoding, cb) {
    this.unzipStream.write(chunk, encoding, cb);
  }

  _flush(cb) {
    const done = () => {
      process.nextTick(() => {
        this.emit('close');
      });
      cb();
    };

    // eslint-disable-next-line consistent-return
    this.unzipStream.end(() => {
      if (this.unfinishedEntries > 0) {
        this.afterFlushWait = true;

        return this.on('await-finished', done);
      }
      done();
    });
  }

  // eslint-disable-next-line consistent-return
  _processEntry(entry) {
    const destPath = path.join(this.opts.path, entry.path);
    const directory = entry.isDirectory ? destPath : path.dirname(destPath);

    this.unfinishedEntries += 1;

    const writeFileFn = () => {
      const pipedStream = fs.createWriteStream(destPath);

      pipedStream.on('close', () => {
        this.unfinishedEntries -= 1;
        this._notifyAwaiter();
      });
      pipedStream.on('error', (error) => {
        this.emit('error', error);
      });
      entry.pipe(pipedStream);
    };

    if (this.createdDirectories[directory] || directory === '.') {
      return writeFileFn();
    }

    // FIXME: calls to mkdirp can still be duplicated
    mkdirp(directory)
      .then(() => {
        this.createdDirectories[directory] = true;

        if (entry.isDirectory) {
          this.unfinishedEntries -= 1;
          this._notifyAwaiter();

          return;
        }

        writeFileFn();
      })
      // eslint-disable-next-line consistent-return
      .catch((err) => {
        if (err) {
          return this.emit('error', err);
        }
      });
  }

  _notifyAwaiter() {
    if (this.afterFlushWait && this.unfinishedEntries === 0) {
      this.emit('await-finished');
      this.afterFlushWait = false;
    }
  }
}

module.exports = Extract;
