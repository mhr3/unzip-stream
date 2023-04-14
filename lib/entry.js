const PassThrough = require('stream').PassThrough;

class Entry extends PassThrough {
  constructor() {
    super();
    if (!(this instanceof Entry)) {
      return new Entry();
    }

    this.path = null;
    this.type = null;
    this.isDirectory = false;
  }

  autodrain() {
    return this.pipe(new stream.Transform({ transform: (d, e, cb) => { cb(); } }));
  }
}

module.exports = Entry;
