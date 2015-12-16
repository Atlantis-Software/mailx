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

Transport.prototype.send = function(message, callback) {
  var messageToSend = {
    from: message.from.toString(),
    to: message.to.toString(),
    cc: message.cc.toString(),
    bcc: message.bcc.toString(),
    subject: message.subject,
    text: message.text,
    html: message.html,
    attachments: message.attachments,
    headers: message.headers
  };

  this.transporter.sendMail(messageToSend, callback);
};

module.exports = Transport;