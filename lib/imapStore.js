var Imap = require('imap');
var Message = require('./message');
var asynk = require('asynk');

var STATE = {
  'CLOSED': 0,
  'CONNECTING': 1,
  'CONNECTED': 3,
  'LOGGED_IN': 4
};

var ImapStore = function() {
  this.status = null;
};

ImapStore.prototype.connect = function(callback) {
  var self = this;
  this.IMAPClient = new Imap({
    user: self.login,
    password: self.password,
    host: self.host,
    port: self.port,
    tls: self.tls,
    autotls: 'always',
    tlsOptions: {rejectUnauthorized: false}
  });
  this.IMAPClient.once('error', function(err) {
    this.end();
    callback(err, null);
  });
  this.IMAPClient.once('ready', function() {
    self.status = STATE.LOGGED_IN;
    callback(null, null);
  });
  this.IMAPClient.once('end', function() {
    self.status = STATE.CLOSED;
  });
  this.IMAPClient.connect();
  this.status = STATE.CONNECTING;
};

ImapStore.prototype.close = function() {
  var self = this;
  self.IMAPClient.closeBox(true, function() {
    self.IMAPClient.end();
  });
};


ImapStore.prototype.getInboxMessages = function(start, callback) {
  var self = this;
  self._openInbox(function(err, box) {
    if (err) {
      return callback(err);
    }
    self._fetch(start, callback);
  });
};

ImapStore.prototype.deleteMessage = function(uid, cb) {
  this.IMAPClient.addFlags(uid, 'DELETED', cb);
};

ImapStore.prototype._openInbox = function(cb) {
  this.IMAPClient.openBox('INBOX', false, cb);
};

ImapStore.prototype._fetch = function(start, callback) {
  var self = this;
  var start = start || 1;
  var msgs = [];
  var fetchMessages = self.IMAPClient.fetch(start + ':*', {bodies: '', struct: true});

  fetchMessages.on('message', function(msg, seqno) {
    var rawMessage = new Buffer(0);
    var uid;
    msg.on('body', function(stream, info) {
      var buffers = [];
      stream.on('data', function(chunk) {
        buffers.push(chunk);
      });
      stream.once('end', function() {
        rawMessage = Buffer.concat(buffers);
      });
    });
    msg.once('attributes', function(attrs) {
      uid = attrs.uid;
    });
    msg.once('end', function() {
      msgs.push({raw: rawMessage, uid: uid, seqno: seqno});
    });
  });
  fetchMessages.once('error', function(err) {
    callback(err, null);
  });
  fetchMessages.once('end', function() {
    var getMessages = asynk.each(msgs, function(message, cb) {
      Message.createFromRaw(message.raw, function(err, msg) {
        if (err) {
          return cb(err);
        }
        msg.delete = function(cb) {
          if (self.status !== STATE.LOGGED_IN) {
            return cb(new Error('NOT LOGGED IN!'));
          }
          self.deleteMessage(message.uid,cb);
        };

        msg.uid = message.uid;
        msg.seqNumber = message.seqno;

        cb(null,msg);
      });
    }).parallel();
    getMessages.done(function(messages) {
      callback(null, messages);
    }).fail(callback);
  });
};

module.exports = ImapStore;