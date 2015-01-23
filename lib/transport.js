var nodemailer = require('nodemailer');
var _ = require('underscore');
var Message = require('./message');


function expand(contacts){
    if(!contacts) return null;
    var expanded = '';
    if(!_.isArray(contacts)) contacts = [contacts];
    contacts.forEach(function(contact){
        expanded += ((contact.name? contact.name + ' ' : '') + '<' + contact.address + '>,').trim();
    });
    return expanded.slice(0,-1);
};

var Transport = module.exports = function Transport(host,port, user, password) {
    this.transporter = nodemailer.createTransport({
        port: port,
        host: host, 
        auth: {
            user: user, 
            pass: password
        }
    });
};

Transport.prototype.send = function(message, callback) {

    var attachments = _.map(message.attachments, function(att) {
        return {
            filename: att.fileName,
            content: att.data,
            encoding: att.encoding,
            contentDisposition:att.disposition,
            contentType:att.contentType,
            cid:att.contentId,
            path:att.path
        };
    });
    
    
    var messageToSend = {
        from: expand(message.from),
        to: expand(message.to),
        cc: expand(message.cc),
        bcc: expand(message.bcc),
        subject: message.subject,
        text: message.text,
        html: message.html,
        attachments: attachments,
        headers : message.headers
    };
    
    this.transporter.sendMail(messageToSend, callback);
};

