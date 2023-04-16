const { PassThrough } = require('stream');
const { Transform } = require('stream');

class Entry extends PassThrough {
  constructor() {
    super();
    if (!(this instanceof Entry)) {
      // eslint-disable-next-line no-constructor-return
      return new Entry();
    }

    this.path = null;
    this.type = null;
    this.isDirectory = false;
  }

  autodrain() {
    return this.pipe(
      new Transform({
        transform: (d, e, cb) => {
          cb();
        },
      })
    );
  }
}

module.exports = Entry;
