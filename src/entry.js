const PassThrough = require('stream').PassThrough;
const Transform = require('stream').Transform;

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
    return this.pipe(new Transform({ transform: (d, e, cb) => { cb(); } }));
  }
}

module.exports = Entry;
