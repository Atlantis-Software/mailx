var Attachment = require('./attachment');
var Address = require('./address');
var MailParser = require("mailparser").MailParser;
var _ = require('underscore');


var Message = function Message() {
  this.headers = {};
  this.messageId = '';
  this.from = new Address();
  this.subject = '';
  this.html = '';
  this.text = '';
  this.size = 0;
  this.date = null;
  this.attachments = [];
  this.to = [];
  this.cc = [];
  this.bcc = [];
  this.seqNumber = null;
  this.uid = null;
};

Message.prototype.delete = function(cb) {
  cb(new Error('NO_STORE'));
};

function createFromRaw(raw, callback) {
  var raw = raw || '';
  var mailParser = new MailParser();
  mailParser.on("end", function(parsedEmail) {
    var msg = new Message();
    if (parsedEmail) {
      msg.messageId = parsedEmail.messageId || '';
      if (parsedEmail.from && parsedEmail.from[0]) {
        msg.from = parsedEmail.from[0];
      }
      msg.subject = parsedEmail.subject || '';
      msg.headers = parsedEmail.headers || {};
      msg.html = parsedEmail.html || '';
      msg.text = parsedEmail.text || '';
      msg.references = parsedEmail.references || [];

      msg.date = parsedEmail.date || parsedEmail.receivedDate;
      msg.attachments = [];
      var parsedAttachments = parsedEmail.attachments || [];
      parsedAttachments.forEach(function(parsedAttachment) {
        var attach = new Attachment(parsedAttachment.generatedFileName, parsedAttachment.content);
        attach.setType(parsedAttachment.contentType);
        attach.setDisposition(parsedAttachment.contentDisposition);
        attach.setEncoding(parsedAttachment.transferEncoding);
        attach.setContentId(parsedAttachment.contentId);
        msg.attachments.push(attach);
      });
      msg.to = parsedEmail.to || [];
      msg.cc = parsedEmail.cc || [];
      msg.bcc = parsedEmail.bcc || [];
    }
    msg.size = raw.length;
    callback(null, msg);
  });
  mailParser.write(raw);
  mailParser.end();
};

Message.prototype.setMessageId = function(messageId) {
  this.messageId = messageId;
};

Message.prototype.setFrom = function(name, address) {
  this.from = new Address(name, address);
};

Message.prototype.setSubject = function(subject) {
  this.subject = subject;
};

Message.prototype.setHtml = function(html) {
  this.html = html;
};

Message.prototype.setText = function(text) {
  this.text = text;
};

Message.prototype.addTo = function(name, address) {
  var to = new Address(name, address);
  this.to.push(to);
};

Message.prototype.addCc = function(name, address) {
  var cc = new Address(name, address);
  this.cc.push(cc);
};

Message.prototype.addBcc = function(name, address) {
  var bcc = new Address(name, address);
  this.bcc.push(bcc);
};

Message.prototype.attach = function(attachment) {
  this.attachments.push(attachment);
};

Message.prototype.addHeader = function(key, value) {
  this.headers[key] = value;
};

Message.prototype.addAttachment = function(fileName, data) {
  var attachment = new Attachment(fileName, data);
  this.attachments.push(attachment);
  return attachment;
};

Message.prototype.getHeader = function(key) {
  return this.headers[key];
};

module.exports = {
  createFromRaw: createFromRaw,
  create: function() {
    return new Message();
  }
};