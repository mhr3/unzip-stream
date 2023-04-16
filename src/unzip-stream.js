/* eslint-disable no-case-declarations, no-console, no-bitwise, max-lines, no-underscore-dangle */
const binary = require('binary');
const stream = require('stream');
const { Transform } = require('stream');
const zlib = require('zlib');
const MatcherStream = require('./matcher-stream');
const Entry = require('./entry');

const states = {
  STREAM_START: 0,
  START: 1,
  LOCAL_FILE_HEADER: 2,
  LOCAL_FILE_HEADER_SUFFIX: 3,
  FILE_DATA: 4,
  FILE_DATA_END: 5,
  DATA_DESCRIPTOR: 6,
  CENTRAL_DIRECTORY_FILE_HEADER: 7,
  CENTRAL_DIRECTORY_FILE_HEADER_SUFFIX: 8,
  CDIR64_END: 9,
  CDIR64_END_DATA_SECTOR: 10,
  CDIR64_LOCATOR: 11,
  CENTRAL_DIRECTORY_END: 12,
  CENTRAL_DIRECTORY_END_COMMENT: 13,
  TRAILING_JUNK: 14,

  ERROR: 99,
};

const FOUR_GIGS = 4294967296;

const SIG_LOCAL_FILE_HEADER = 0x04034b50;
const SIG_DATA_DESCRIPTOR = 0x08074b50;
const SIG_CDIR_RECORD = 0x02014b50;
const SIG_CDIR64_RECORD_END = 0x06064b50;
const SIG_CDIR64_LOCATOR_END = 0x07064b50;
const SIG_CDIR_RECORD_END = 0x06054b50;

const cp437 =
  '\u0000☺☻♥♦♣♠•◘○◙♂♀♪♫☼►◄↕‼¶§▬↨↑↓→←∟↔▲▼ !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~⌂ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ ';

class UnzipStream extends Transform {
  constructor(opts) {
    super();
    if (!(this instanceof UnzipStream)) {
      // eslint-disable-next-line no-constructor-return
      return new UnzipStream(opts);
    }

    this.options = opts || {};
    this.data = Buffer.from('');
    this.state = states.STREAM_START;
    this.skippedBytes = 0;
    this.parsedEntity = null;
    this.outStreamInfo = {};
  }

  processDataChunk(chunk) {
    let requiredLength;

    switch (this.state) {
      case states.STREAM_START:
      case states.START:
        requiredLength = 4;
        break;
      case states.LOCAL_FILE_HEADER:
        requiredLength = 26;
        break;
      case states.LOCAL_FILE_HEADER_SUFFIX:
        requiredLength = this.parsedEntity.fileNameLength + this.parsedEntity.extraFieldLength;
        break;
      case states.DATA_DESCRIPTOR:
        requiredLength = 12;
        break;
      case states.CENTRAL_DIRECTORY_FILE_HEADER:
        requiredLength = 42;
        break;
      case states.CENTRAL_DIRECTORY_FILE_HEADER_SUFFIX:
        requiredLength =
          this.parsedEntity.fileNameLength + this.parsedEntity.extraFieldLength + this.parsedEntity.fileCommentLength;
        break;
      case states.CDIR64_END:
        requiredLength = 52;
        break;
      case states.CDIR64_END_DATA_SECTOR:
        requiredLength = this.parsedEntity.centralDirectoryRecordSize - 44;
        break;
      case states.CDIR64_LOCATOR:
        requiredLength = 16;
        break;
      case states.CENTRAL_DIRECTORY_END:
        requiredLength = 18;
        break;
      case states.CENTRAL_DIRECTORY_END_COMMENT:
        requiredLength = this.parsedEntity.commentLength;
        break;
      case states.FILE_DATA:
        return 0;
      case states.FILE_DATA_END:
        return 0;
      case states.TRAILING_JUNK:
        if (this.options.debug) {
          console.log(`found ${chunk.length} bytes of TRAILING_JUNK`);
        }

        return chunk.length;
      default:
        return chunk.length;
    }

    if (chunk.length < requiredLength) {
      return 0;
    }

    switch (this.state) {
      case states.STREAM_START:
      case states.START:
        const signature = chunk.readUInt32LE(0);
        switch (signature) {
          case SIG_LOCAL_FILE_HEADER:
            this.state = states.LOCAL_FILE_HEADER;
            break;
          case SIG_CDIR_RECORD:
            this.state = states.CENTRAL_DIRECTORY_FILE_HEADER;
            break;
          case SIG_CDIR64_RECORD_END:
            this.state = states.CDIR64_END;
            break;
          case SIG_CDIR64_LOCATOR_END:
            this.state = states.CDIR64_LOCATOR;
            break;
          case SIG_CDIR_RECORD_END:
            this.state = states.CENTRAL_DIRECTORY_END;
            break;
          default:
            const isStreamStart = this.state === states.STREAM_START;
            if (!isStreamStart && (signature & 0xffff) !== 0x4b50 && this.skippedBytes < 26) {
              // we'll allow a padding of max 28 bytes
              let remaining = signature;
              let toSkip = 4;

              for (let i = 1; i < 4 && remaining !== 0; i++) {
                remaining >>>= 8;
                if ((remaining & 0xff) === 0x50) {
                  toSkip = i;
                  break;
                }
              }
              this.skippedBytes += toSkip;
              if (this.options.debug) {
                console.log(`Skipped ${this.skippedBytes} bytes`);
              }

              return toSkip;
            }
            this.state = states.ERROR;
            const errMsg = isStreamStart ? 'Not a valid zip file' : 'Invalid signature in zip file';
            if (this.options.debug) {
              const sig = chunk.readUInt32LE(0);
              let asString;
              try {
                asString = chunk.slice(0, 4).toString();
              } catch (e) {
                console.error(e);
              }
              console.log(
                `Unexpected signature in zip file: 0x${sig.toString(16)} "${asString}" skipped ${
                  this.skippedBytes
                } bytes`
              );
            }
            this.emit('error', new Error(errMsg));

            return chunk.length;
        }
        this.skippedBytes = 0;

        return requiredLength;

      case states.LOCAL_FILE_HEADER:
        this.parsedEntity = this._readFile(chunk);
        this.state = states.LOCAL_FILE_HEADER_SUFFIX;

        return requiredLength;

      case states.LOCAL_FILE_HEADER_SUFFIX: {
        const entry = new Entry();
        const isUtf8 = (this.parsedEntity.flags & 0x800) !== 0;
        const extraDataBuffer = chunk.slice(
          this.parsedEntity.fileNameLength,
          this.parsedEntity.fileNameLength + this.parsedEntity.extraFieldLength
        );
        const extra = this._readExtraFields(extraDataBuffer);
        entry.path = this._decodeString(chunk.slice(0, this.parsedEntity.fileNameLength), isUtf8);

        if (extra?.parsed) {
          if (extra.parsed.path && !isUtf8) {
            entry.path = extra.parsed.path;
          }
          if (Number.isFinite(extra.parsed.uncompressedSize) && this.parsedEntity.uncompressedSize === FOUR_GIGS - 1) {
            this.parsedEntity.uncompressedSize = extra.parsed.uncompressedSize;
          }
          if (Number.isFinite(extra.parsed.compressedSize) && this.parsedEntity.compressedSize === FOUR_GIGS - 1) {
            this.parsedEntity.compressedSize = extra.parsed.compressedSize;
          }
        }
        this.parsedEntity.extra = extra.parsed || {};

        if (this.options.debug) {
          const debugObj = {
            ...this.parsedEntity,
            path: entry.path,
            flags: `0x${this.parsedEntity.flags.toString(16)}`,
            extraFields: extra?.debug,
          };
          console.log(`decoded LOCAL_FILE_HEADER: ${JSON.stringify(debugObj, null, 2)}`);
        }
        this._prepareOutStream(this.parsedEntity, entry);

        this.emit('entry', entry);

        this.state = states.FILE_DATA;

        return requiredLength;
      }
      case states.CENTRAL_DIRECTORY_FILE_HEADER:
        this.parsedEntity = this._readCentralDirectoryEntry(chunk);
        this.state = states.CENTRAL_DIRECTORY_FILE_HEADER_SUFFIX;

        return requiredLength;

      case states.CENTRAL_DIRECTORY_FILE_HEADER_SUFFIX: {
        // got file name in chunk[0..]
        const isUtf8 = (this.parsedEntity.flags & 0x800) !== 0;
        const extraDataBuffer = chunk.slice(
          this.parsedEntity.fileNameLength,
          this.parsedEntity.fileNameLength + this.parsedEntity.extraFieldLength
        );
        const extra = this._readExtraFields(extraDataBuffer);
        let path = this._decodeString(chunk.slice(0, this.parsedEntity.fileNameLength), isUtf8);
        if (extra?.parsed?.path && !isUtf8) {
          path = extra.parsed.path;
        }
        this.parsedEntity.extra = extra.parsed;

        const isUnix = (this.parsedEntity.versionMadeBy & 0xff00) >> 8 === 3;
        let unixAttrs;
        let isSymlink;

        if (isUnix) {
          unixAttrs = this.parsedEntity.externalFileAttributes >>> 16;
          const fileType = unixAttrs >>> 12;
          isSymlink = (fileType & 0o12) === 0o12; // __S_IFLNK
        }
        if (this.options.debug) {
          const debugObj = {
            ...this.parsedEntity,
            path,
            flags: `0x${this.parsedEntity.flags.toString(16)}`,
            unixAttrs: unixAttrs && `0${unixAttrs.toString(8)}`,
            isSymlink,
            extraFields: extra.debug,
          };
          console.log(`decoded CENTRAL_DIRECTORY_FILE_HEADER: ${JSON.stringify(debugObj, null, 2)}`);
        }
        this.state = states.START;

        return requiredLength;
      }
      case states.CDIR64_END:
        this.parsedEntity = this._readEndOfCentralDirectory64(chunk);
        if (this.options.debug) {
          console.log('decoded CDIR64_END_RECORD:', this.parsedEntity);
        }
        this.state = states.CDIR64_END_DATA_SECTOR;

        return requiredLength;

      case states.CDIR64_END_DATA_SECTOR:
      case states.CDIR64_LOCATOR:
        this.state = states.START;

        return requiredLength;

      case states.CENTRAL_DIRECTORY_END:
        this.parsedEntity = this._readEndOfCentralDirectory(chunk);
        if (this.options.debug) {
          console.log('decoded CENTRAL_DIRECTORY_END:', this.parsedEntity);
        }
        this.state = states.CENTRAL_DIRECTORY_END_COMMENT;

        return requiredLength;

      case states.CENTRAL_DIRECTORY_END_COMMENT:
        if (this.options.debug) {
          console.log('decoded CENTRAL_DIRECTORY_END_COMMENT:', chunk.slice(0, requiredLength).toString());
        }
        this.state = states.TRAILING_JUNK;

        return requiredLength;

      case states.ERROR:
        return chunk.length; // discard

      default:
        console.log(`didn't handle state #${this.state} discarding`);

        return chunk.length;
    }
  }

  _prepareOutStream(vars, entry) {
    const isDirectory = vars.uncompressedSize === 0 && /[/\\]$/.test(entry.path);
    // protect against malicious zip files which want to extract to parent dirs
    // eslint-disable-next-line no-param-reassign
    entry.path = entry.path.replace(/^([/\\]*[.]+[/\\]+)*[/\\]*/, '');
    // eslint-disable-next-line no-param-reassign
    entry.type = isDirectory ? 'Directory' : 'File';
    // eslint-disable-next-line no-param-reassign
    entry.isDirectory = isDirectory;

    const fileSizeKnown = !(vars.flags & 0x08);
    if (fileSizeKnown) {
      // eslint-disable-next-line no-param-reassign
      entry.size = vars.uncompressedSize;
    }

    const isVersionSupported = vars.versionsNeededToExtract <= 45;
    const limit = fileSizeKnown ? vars.compressedSize : -1;

    this.outStreamInfo = {
      stream: null,
      limit,
      written: 0,
    };

    if (!fileSizeKnown) {
      const pattern = Buffer.alloc(4);
      pattern.writeUInt32LE(SIG_DATA_DESCRIPTOR, 0);
      const { zip64Mode } = vars.extra;
      const extraSize = zip64Mode ? 20 : 12;
      const searchPattern = {
        pattern,
        requiredExtraSize: extraSize,
      };

      const matcherStream = new MatcherStream(searchPattern, (matchedChunk, sizeSoFar) => {
        const data = this._readDataDescriptor(matchedChunk, zip64Mode);

        let compressedSizeMatches = data.compressedSize === sizeSoFar;
        // let's also deal with archives with 4GiB+ files without zip64
        if (!zip64Mode && !compressedSizeMatches && sizeSoFar >= FOUR_GIGS) {
          let overflown = sizeSoFar - FOUR_GIGS;
          while (overflown >= 0) {
            compressedSizeMatches = data.compressedSize === overflown;
            if (compressedSizeMatches) {
              break;
            }
            overflown -= FOUR_GIGS;
          }
        }
        if (!compressedSizeMatches) {
          return;
        }

        this.state = states.FILE_DATA_END;
        const sliceOffset = zip64Mode ? 24 : 16;
        if (this.data.length > 0) {
          this.data = Buffer.concat([matchedChunk.slice(sliceOffset), this.data]);
        } else {
          this.data = matchedChunk.slice(sliceOffset);
        }

        // eslint-disable-next-line consistent-return
        return true;
      });
      this.outStreamInfo.stream = matcherStream;
    } else {
      this.outStreamInfo.stream = new stream.PassThrough();
    }

    const isEncrypted = vars.flags & 0x01 || vars.flags & 0x40;

    if (isEncrypted || !isVersionSupported) {
      const message = isEncrypted
        ? 'Encrypted files are not supported!'
        : `Zip version ${Math.floor(vars.versionsNeededToExtract / 10)}.${
            vars.versionsNeededToExtract % 10
          } is not supported`;

      // eslint-disable-next-line no-param-reassign
      entry.skip = true;
      setImmediate(() => {
        entry.emit('error', new Error(message));
      });

      // try to skip over this entry
      this.outStreamInfo.stream.pipe(new Entry().autodrain());

      return;
    }

    const isCompressed = vars.compressionMethod > 0;
    if (isCompressed) {
      const inflater = zlib.createInflateRaw();
      inflater.on('error', (err) => {
        this.state = states.ERROR;
        this.emit('error', err);
      });
      this.outStreamInfo.stream.pipe(inflater).pipe(entry);
    } else {
      this.outStreamInfo.stream.pipe(entry);
    }

    if (this._drainAllEntries) {
      entry.autodrain();
    }
  }

  // eslint-disable-next-line class-methods-use-this
  _readFile(data) {
    const { vars } = binary
      .parse(data)
      .word16lu('versionsNeededToExtract')
      .word16lu('flags')
      .word16lu('compressionMethod')
      .word16lu('lastModifiedTime')
      .word16lu('lastModifiedDate')
      .word32lu('crc32')
      .word32lu('compressedSize')
      .word32lu('uncompressedSize')
      .word16lu('fileNameLength')
      .word16lu('extraFieldLength');

    return vars;
  }

  _readExtraFields(data) {
    const extra = {};
    const result = { parsed: extra };

    if (this.options.debug) {
      result.debug = [];
    }

    let index = 0;
    let offset = 0;

    while (index < data.length) {
      const { vars } = binary.parse(data).skip(index).word16lu('extraId').word16lu('extraSize');

      index += 4;

      let fieldType;

      switch (vars.extraId) {
        case 0x0001:
          fieldType = 'Zip64 extended information extra field';
          const z64vars = binary
            .parse(data.slice(index, index + vars.extraSize))
            .word64lu('uncompressedSize')
            .word64lu('compressedSize')
            .word64lu('offsetToLocalHeader')
            .word32lu('diskStartNumber').vars;
          if (z64vars.uncompressedSize !== null) {
            extra.uncompressedSize = z64vars.uncompressedSize;
          }
          if (z64vars.compressedSize !== null) {
            extra.compressedSize = z64vars.compressedSize;
          }
          extra.zip64Mode = true;
          break;
        case 0x000a:
          fieldType = 'NTFS extra field';
          break;
        case 0x5455:
          fieldType = 'extended timestamp';
          const timestampFields = data.readUInt8(index);
          offset = 1;
          if (vars.extraSize >= offset + 4 && timestampFields & 1) {
            extra.mtime = new Date(data.readUInt32LE(index + offset) * 1000);
            offset += 4;
          }
          if (vars.extraSize >= offset + 4 && timestampFields & 2) {
            extra.atime = new Date(data.readUInt32LE(index + offset) * 1000);
            offset += 4;
          }
          if (vars.extraSize >= offset + 4 && timestampFields & 4) {
            extra.ctime = new Date(data.readUInt32LE(index + offset) * 1000);
          }
          break;
        case 0x7075:
          fieldType = 'Info-ZIP Unicode Path Extra Field';
          const fieldVer = data.readUInt8(index);
          if (fieldVer === 1) {
            offset = 1;
            // TODO: should be checking this against our path buffer
            // const nameCrc32 = data.readUInt32LE(index + offset);
            offset += 4;
            const pathBuffer = data.slice(index + offset);
            extra.path = pathBuffer.toString();
          }
          break;
        case 0x000d:
        case 0x5855:
          fieldType = vars.extraId === 0x000d ? 'PKWARE Unix' : 'Info-ZIP UNIX (type 1)';
          offset = 0;

          if (vars.extraSize >= 8) {
            const atime = new Date(data.readUInt32LE(index + offset) * 1000);
            offset += 4;
            const mtime = new Date(data.readUInt32LE(index + offset) * 1000);
            offset += 4;
            extra.atime = atime;
            extra.mtime = mtime;

            if (vars.extraSize >= 12) {
              const uid = data.readUInt16LE(index + offset);
              offset += 2;
              const gid = data.readUInt16LE(index + offset);
              offset += 2;
              extra.uid = uid;
              extra.gid = gid;
            }
          }
          break;
        case 0x7855:
          fieldType = 'Info-ZIP UNIX (type 2)';
          offset = 0;
          if (vars.extraSize >= 4) {
            const uid = data.readUInt16LE(index + offset);
            offset += 2;
            const gid = data.readUInt16LE(index + offset);
            offset += 2;
            extra.uid = uid;
            extra.gid = gid;
          }
          break;
        case 0x7875:
          fieldType = 'Info-ZIP New Unix';
          offset = 0;
          const extraVer = data.readUInt8(index);
          offset += 1;

          if (extraVer === 1) {
            const uidSize = data.readUInt8(index + offset);
            offset += 1;
            if (uidSize <= 6) {
              extra.uid = data.readUIntLE(index + offset, uidSize);
            }
            offset += uidSize;

            const gidSize = data.readUInt8(index + offset);
            offset += 1;
            if (gidSize <= 6) {
              extra.gid = data.readUIntLE(index + offset, gidSize);
            }
          }
          break;
        case 0x756e:
          fieldType = 'ASi Unix';
          offset = 0;

          if (vars.extraSize >= 14) {
            // const crc = data.readUInt32LE(index + offset);
            offset += 4;
            const mode = data.readUInt16LE(index + offset);
            offset += 2;
            // const sizdev = data.readUInt32LE(index + offset);
            offset += 4;
            const uid = data.readUInt16LE(index + offset);
            offset += 2;
            const gid = data.readUInt16LE(index + offset);
            offset += 2;
            extra.mode = mode;
            extra.uid = uid;
            extra.gid = gid;

            if (vars.extraSize > 14) {
              const start = index + offset;
              const end = index + vars.extraSize - 14;
              const symlinkName = this._decodeString(data.slice(start, end));
              extra.symlink = symlinkName;
            }
          }
          break;
        default:
          break;
      }

      if (this.options.debug) {
        result.debug.push({
          extraId: `0x${vars.extraId.toString(16)}`,
          description: fieldType,
          data: data.slice(index, index + vars.extraSize).inspect(),
        });
      }

      index += vars.extraSize;
    }

    return result;
  }

  // eslint-disable-next-line class-methods-use-this
  _readDataDescriptor(data, zip64Mode) {
    if (zip64Mode) {
      const { vars } = binary
        .parse(data)
        .word32lu('dataDescriptorSignature')
        .word32lu('crc32')
        .word64lu('compressedSize')
        .word64lu('uncompressedSize');

      return vars;
    }

    const { vars } = binary
      .parse(data)
      .word32lu('dataDescriptorSignature')
      .word32lu('crc32')
      .word32lu('compressedSize')
      .word32lu('uncompressedSize');

    return vars;
  }

  // eslint-disable-next-line class-methods-use-this
  _readCentralDirectoryEntry(data) {
    const { vars } = binary
      .parse(data)
      .word16lu('versionMadeBy')
      .word16lu('versionsNeededToExtract')
      .word16lu('flags')
      .word16lu('compressionMethod')
      .word16lu('lastModifiedTime')
      .word16lu('lastModifiedDate')
      .word32lu('crc32')
      .word32lu('compressedSize')
      .word32lu('uncompressedSize')
      .word16lu('fileNameLength')
      .word16lu('extraFieldLength')
      .word16lu('fileCommentLength')
      .word16lu('diskNumber')
      .word16lu('internalFileAttributes')
      .word32lu('externalFileAttributes')
      .word32lu('offsetToLocalFileHeader');

    return vars;
  }

  // eslint-disable-next-line class-methods-use-this
  _readEndOfCentralDirectory64(data) {
    const { vars } = binary
      .parse(data)
      .word64lu('centralDirectoryRecordSize')
      .word16lu('versionMadeBy')
      .word16lu('versionsNeededToExtract')
      .word32lu('diskNumber')
      .word32lu('diskNumberWithCentralDirectoryStart')
      .word64lu('centralDirectoryEntries')
      .word64lu('totalCentralDirectoryEntries')
      .word64lu('sizeOfCentralDirectory')
      .word64lu('offsetToStartOfCentralDirectory');

    return vars;
  }

  // eslint-disable-next-line class-methods-use-this
  _readEndOfCentralDirectory(data) {
    const { vars } = binary
      .parse(data)
      .word16lu('diskNumber')
      .word16lu('diskStart')
      .word16lu('centralDirectoryEntries')
      .word16lu('totalCentralDirectoryEntries')
      .word32lu('sizeOfCentralDirectory')
      .word32lu('offsetToStartOfCentralDirectory')
      .word16lu('commentLength');

    return vars;
  }

  _decodeString(buffer, isUtf8) {
    if (isUtf8) {
      return buffer.toString('utf8');
    }
    // allow passing custom decoder
    if (this.options.decodeString) {
      return this.options.decodeString(buffer);
    }
    let result = '';

    buffer.forEach((part) => {
      result += cp437[part];
    });

    return result;
  }

  _parseOrOutput(encoding, cb) {
    let consume;
    // eslint-disable-next-line no-cond-assign
    while ((consume = this.processDataChunk(this.data)) > 0) {
      this.data = this.data.subarray(consume);
      if (this.data.length === 0) {
        break;
      }
    }

    if (this.state === states.FILE_DATA) {
      if (this.outStreamInfo.limit >= 0) {
        const remaining = this.outStreamInfo.limit - this.outStreamInfo.written;
        let packet;

        if (remaining < this.data.length) {
          packet = this.data.subarray(0, remaining);
          this.data = this.data.subarray(remaining);
        } else {
          packet = this.data;
          this.data = Buffer.from('');
        }

        this.outStreamInfo.written += packet.length;
        if (this.outStreamInfo.limit === this.outStreamInfo.written) {
          this.state = states.START;

          this.outStreamInfo.stream.end(packet, encoding, cb);
        } else {
          this.outStreamInfo.stream.write(packet, encoding, cb);
        }
      } else {
        const packet = this.data;
        this.data = Buffer.from('');

        this.outStreamInfo.written += packet.length;
        const outputStream = this.outStreamInfo.stream;
        // eslint-disable-next-line consistent-return
        outputStream.write(packet, encoding, () => {
          if (this.state === states.FILE_DATA_END) {
            this.state = states.START;

            return outputStream.end(cb);
          }
          cb();
        });
      }

      // we've written to the output stream, letting that write deal with the callback
      return;
    }

    cb();
  }

  drainAll() {
    this._drainAllEntries = true;
  }

  _transform(chunk, encoding, cb) {
    if (this.data.length > 0) {
      this.data = Buffer.concat([this.data, chunk]);
    } else {
      this.data = chunk;
    }

    let startDataLength = this.data.length;
    const done = () => {
      if (this.data.length > 0 && this.data.length < startDataLength) {
        startDataLength = this.data.length;
        this._parseOrOutput(encoding, done);

        return;
      }
      cb();
    };
    this._parseOrOutput(encoding, done);
  }

  _flush(cb) {
    if (this.data.length > 0) {
      // eslint-disable-next-line consistent-return
      this._parseOrOutput('buffer', () => {
        if (this.data.length > 0) {
          return setImmediate(() => {
            this._flush(cb);
          });
        }
        cb();
      });

      return;
    }

    if (this.state === states.FILE_DATA) {
      // eslint-disable-next-line consistent-return
      return cb(new Error('Stream finished in an invalid state, uncompression failed'));
    }

    setImmediate(cb);
  }
}

module.exports = UnzipStream;
