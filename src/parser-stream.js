const { Transform } = require('stream');
const UnzipStream = require('./unzip-stream');

class ParserStream extends Transform {
  constructor(opts) {
    super({ readableObjectMode: true });
    if (!(this instanceof ParserStream)) {
      // eslint-disable-next-line no-constructor-return
      return new ParserStream(opts);
    }

    this.opts = opts || {};
    this.unzipStream = new UnzipStream(this.opts);

    this.unzipStream.on('entry', (entry) => {
      this.push(entry);
    });
    this.unzipStream.on('error', (error) => {
      this.emit('error', error);
    });
  }

  _transform(chunk, encoding, cb) {
    this.unzipStream.write(chunk, encoding, cb);
  }

  _flush(cb) {
    this.unzipStream.end(() => {
      process.nextTick(() => {
        this.emit('close');
      });
      cb();
    });
  }

  on(eventName, fn) {
    if (eventName === 'entry') {
      return Transform.prototype.on.call(this, 'data', fn);
    }

    return Transform.prototype.on.call(this, eventName, fn);
  }

  drainAll() {
    this.unzipStream.drainAll();

    return this.pipe(
      new Transform({
        objectMode: true,
        transform: (d, e, cb) => {
          cb();
        },
      })
    );
  }
}

module.exports = ParserStream;
