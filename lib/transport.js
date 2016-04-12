var nodemailer = require('nodemailer');

var Transport = function Transport(host, port, user, password) {
  var cfg = {};
  cfg.host = host || 'localhost';
  cfg.port = port || 25;
  if (user && password) {
    cfg.auth = {
      user: user,
      pass: password
    };
  }
  this.transporter = nodemailer.createTransport(cfg);
};

function expand(contacts) {
    if(!contacts) return null;
    var expanded = '';
    if(!_.isArray(contacts)) contacts = [contacts];
    contacts.forEach(function(contact) {
      expanded += ((contact.name? contact.name + ' ' : '') + '<' + contact.address + '>,').trim();
    });
    return expanded.slice(0,-1);
};

Transport.prototype.send = function(message, callback) {
  var attachments = _.map(message.attachments, function(att) {
    return {
      filename: att.fileName,
      content: att.content,
      encoding: att.encoding,
      contentType:att.contentType,
      cid:att.cid
    };
  }); 
  var messageToSend = {
    from: message.from.toString(),
    to: expand(message.to),
    cc: expand(message.cc),
    bcc: expand(message.bcc),
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: attachments,
    headers: message.headers
  };

  this.transporter.sendMail(messageToSend, callback);
};

module.exports = Transport;