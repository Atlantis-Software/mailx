var fs = require('fs');

var Attachment = module.exports = function Attachment(parsedAttachment) {
    this.data = (parsedAttachment && parsedAttachment.content) ? parsedAttachment.content : null;
    this.fileName = (parsedAttachment && parsedAttachment.fileName) ? parsedAttachment.fileName : null;
    this.type = (parsedAttachment && parsedAttachment.contentType) ? parsedAttachment.contentType : null;
    this.size = (parsedAttachment && parsedAttachment.length) ? parsedAttachment.length : -1;
    this.disposition = (parsedAttachment && parsedAttachment.contentDisposition) ? parsedAttachment.contentDisposition : null;
    this.encoding = (parsedAttachment && parsedAttachment.transferEncoding) ? parsedAttachment.transferEncoding : null;
    this.checkSum = (parsedAttachment && parsedAttachment.checksum) ? parsedAttachment.checksum : null;
    this.contentId = (parsedAttachment && parsedAttachment.contentId) ? parsedAttachment.contentId : null;
    this.generatedFileName = (parsedAttachment && parsedAttachment.generatedFileName) ? parsedAttachment.generatedFileName : null;
};

Attachment.prototype.setData = function(data) {
    this.data = data;
};

Attachment.prototype.setFileName = function(fileName) {
    this.fileName = fileName;
};

Attachment.prototype.setType = function(type) {
    this.type = type;
};

Attachment.prototype.setSize = function(size) {
    this.size = size;
};

Attachment.prototype.setDisposition = function(disposition) {
    this.disposition = disposition;
};

Attachment.prototype.setEncoding = function(encoding) {
    this.encoding = encoding;
};

Attachment.prototype.setCheckSum = function(checkSum) {
    this.checkSum = checkSum;
};

Attachment.prototype.setContentId = function(contentId) {
    this.contentId = contentId;
};

Attachment.prototype.setGeneratedFileName = function(generatedFileName) {
    this.type = generatedFileName;
};


Attachment.prototype.loadFromDisk = function(filePath, callback) {
    var self = this;
    fs.readFile(filePath, function(err, data) {
        if (err) {
            console.log(err);
            callback(err, null);
        }
        else {
            var splittedPath = filePath.split('/');
            self.fileName = splittedPath[splittedPath.length - 1];
            self.size = data.length;
            self.data = data;
            callback(null, self.data);
        }
    });
};