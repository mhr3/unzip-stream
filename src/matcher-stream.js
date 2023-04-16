const { Transform } = require('stream');

class MatcherStream extends Transform {
  constructor(patternDesc, matchFn) {
    super();

    if (!(this instanceof MatcherStream)) {
      // eslint-disable-next-line no-constructor-return
      return new MatcherStream();
    }

    const p = typeof patternDesc === 'object' ? patternDesc.pattern : patternDesc;

    this.pattern = Buffer.isBuffer(p) ? p : Buffer.from(p);
    this.requiredLength = this.pattern.length;
    if (patternDesc.requiredExtraSize) {
      this.requiredLength += patternDesc.requiredExtraSize;
    }

    this.data = Buffer.from('');
    this.bytesSoFar = 0;

    this.matchFn = matchFn;
  }

  checkDataChunk(ignoreMatchZero) {
    const enoughData = this.data.length >= this.requiredLength; // strict more than ?
    if (!enoughData) {
      return;
    }

    const byteOffset = ignoreMatchZero ? 1 : 0;
    const matchIndex = this.data.indexOf(this.pattern, byteOffset);
    if (matchIndex >= 0 && matchIndex + this.requiredLength > this.data.length) {
      if (matchIndex > 0) {
        const packet = this.data.subarray(0, matchIndex);
        this.push(packet);
        this.bytesSoFar += matchIndex;
        this.data = this.data.subarray(matchIndex);
      }

      return;
    }

    if (matchIndex === -1) {
      const packetLen = this.data.length - this.requiredLength + 1;

      const packet = this.data.subarray(0, packetLen);
      this.push(packet);
      this.bytesSoFar += packetLen;
      this.data = this.data.subarray(packetLen);

      return;
    }

    // found match
    if (matchIndex > 0) {
      const packet = this.data.subarray(0, matchIndex);
      this.data = this.data.subarray(matchIndex);
      this.push(packet);
      this.bytesSoFar += matchIndex;
    }

    const finished = this.matchFn ? this.matchFn(this.data, this.bytesSoFar) : true;
    if (finished) {
      this.data = Buffer.from('');

      return;
    }

    // eslint-disable-next-line consistent-return
    return true;
  }

  _transform(chunk, encoding, cb) {
    this.data = Buffer.concat([this.data, chunk]);

    let firstIteration = true;
    while (this.checkDataChunk(!firstIteration)) {
      firstIteration = false;
    }

    cb();
  }

  _flush(cb) {
    if (this.data.length > 0) {
      let firstIteration = true;
      while (this.checkDataChunk(!firstIteration)) {
        firstIteration = false;
      }
    }

    if (this.data.length > 0) {
      this.push(this.data);
      this.data = null;
    }

    cb();
  }
}

module.exports = MatcherStream;
