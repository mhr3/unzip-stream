const fs = require('fs');
const path = require('path');
const mkdirp = require('mkdirp');
const Transform = require('stream').Transform;
const UnzipStream = require('./unzip-stream');

class Extract extends Transform {
  constructor(opts) {
    super();
    if (!(this instanceof Extract)) {
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
      process.nextTick(() => { this.emit('close'); });
      cb();
    }

    this.unzipStream.end(() => {
      if (this.unfinishedEntries > 0) {
        this.afterFlushWait = true;

        return this.on('await-finished', done);
      }
      done();
    });
  }

  _processEntry(entry) {
    const destPath = path.join(this.opts.path, entry.path);
    const directory = entry.isDirectory ? destPath : path.dirname(destPath);

    this.unfinishedEntries++;

    const writeFileFn = () => {
      const pipedStream = fs.createWriteStream(destPath);

      pipedStream.on('close', () => {
        this.unfinishedEntries--;
        this._notifyAwaiter();
      });
      pipedStream.on('error', (error) => {
        this.emit('error', error);
      });
      entry.pipe(pipedStream);
    }

    if (this.createdDirectories[directory] || directory === '.') {
      return writeFileFn();
    }

    // FIXME: calls to mkdirp can still be duplicated
    mkdirp(directory, (err) => {
      if (err) {
        return this.emit('error', err);
      }

      this.createdDirectories[directory] = true;

      if (entry.isDirectory) {
        this.unfinishedEntries--;
        this._notifyAwaiter();

        return;
      }

      writeFileFn();
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
