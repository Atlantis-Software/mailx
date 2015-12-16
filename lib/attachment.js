var Attachment = function Attachment(fileName,data) {
  this.fileName = fileName || 'unnamed';
  this.content = data || null;
  if (Buffer.isBuffer(data)) {
    this.encoding = 'binary';
    this.size = data.length;
  } else {
    this.encoding = 'base64';
    this.size = (data.length / 4) * 3;
  }
  this.cid = fileName;
};

Attachment.prototype.contentType = 'attachment';

Attachment.prototype.setData = function(data) {
  if (data) {
    this.content = data;
  }
};

Attachment.prototype.setFileName = function(fileName) {
  if (fileName) {
    this.fileName = fileName;
  }
};

Attachment.prototype.setType = function(type) {
  if (type) {
    this.contentType = type;
  }
};

Attachment.prototype.setSize = function(size) {
  if (size) {
    this.size = size;
  }
};

Attachment.prototype.setDisposition = function(disposition) {
  if (disposition) {
    this.contentDisposition = disposition;
  }
};

Attachment.prototype.setEncoding = function(encoding) {
  if (encoding) {
    this.encoding = encoding;
  }
};

Attachment.prototype.setContentId = function(contentId) {
  if (contentId) {
    this.cid = contentId;
  }
};

module.exports = Attachment;