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
    tlsOptions: { rejectUnauthorized: false }
  });
  this.IMAPClient.once('error', function(err) {
    this.end();
    var cb = callback;
    callback = function() { };
    cb(err, null);
  });
  this.IMAPClient.once('ready', function() {
    self.status = STATE.LOGGED_IN;
    var cb = callback;
    callback = function() { };
    cb(null, null);
  });
  this.IMAPClient.once('end', function() {
    self.status = STATE.CLOSED;
  });
  this.IMAPClient.connect();
  this.status = STATE.CONNECTING;
};

ImapStore.prototype.close = function(callback) {
  try {
    this.status = STATE.CLOSED;
    this.IMAPClient.end();
    if (callback) {
      callback();
    }
  } catch (e) {
    if (callback) {
      return callback(e);
    }
    throw e;
  }
};

ImapStore.prototype.getInbox = function(start) {
  var defer = asynk.deferred();
  this.inboxMessagesQueue = [];
  this.getNextMessageQueue = [];
  var self = this;
  self._openInbox(function(err, box) {
    if (err) {
      return defer.reject(err);
    }
    var startFrom = start || 1;
    var fetchMessages = self.IMAPClient.fetch(startFrom + ':' + box.uidnext, { bodies: '', struct: true });
    var count = 0;
    var notified = 0;
    self._end = false;

    fetchMessages.on('message', function(msg, seqno) {
      count++;
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
        Message.createFromRaw(rawMessage, function(err, msg) {
          if (err) {
            return defer.reject(err);
          }
          msg.delete = function(cb) {
            if (self.status !== STATE.LOGGED_IN) {
              return cb(new Error('NOT LOGGED IN!'));
            }
            self.deleteMessage(uid, cb);
          };

          msg.uid = uid;
          msg.seqNumber = seqno;
          defer.notify(msg);
          // if no waiting getNextMessage in queue then push message in inboxMessagesQueue
          if (self.getNextMessageQueue.length === 0) {
            self.inboxMessagesQueue.push(msg);
          } else {
            var cb = self.getNextMessageQueue.shift();
            cb(null, msg);
          }
          notified++;
          if (self._end && count === notified) {
            defer.resolve({ received: count });
          }
        });
      });
    });

    fetchMessages.once('error', function(err) {
      defer.reject(err);
      try {
        self.IMAPClient.closeBox(true);
        self.IMAPClient.end();
      } catch (e) {
        return;
      }
    });

    fetchMessages.once('end', function() {
      self._end = true;
      if ((self.inboxMessagesQueue.length === 0) && (count === notified)) {
        for (var i = 0; i < self.getNextMessageQueue.length; i++) {
          var cb = self.getNextMessageQueue.shift();
          cb(null, null);
        }
        defer.resolve({ received: count });
      }
    });
  });

  return defer.promise({
    close: function(cb) {
      var cb = cb || function() { };
      self.IMAPClient.closeBox(true, function(err) {
        self.IMAPClient.end();
        if (err) {
          return cb(err);
        }
        cb();
      });
    },
    getNextMessage: function(cb) {
      // if no message in inboxMessagesQueue then push callback in getNextMessageQueue
      if (self.inboxMessagesQueue.length === 0) {
        // check if all messages has been received
        if (self._end) {
          return cb(null, null);
        }
        self.getNextMessageQueue.push(cb);
      } else {
        cb(null, self.inboxMessagesQueue.shift());
      }
    }
  });
};

ImapStore.prototype.getInboxMessages = function(start, callback) {
  var self = this;
  self._openInbox(function(err, box) {
    if (err) {
      return callback(err);
    }
    self._fetch(start, function(err, data) {
      if (err) {
        return callback(err, data);
      }
      self.IMAPClient.closeBox(true, function(err) {
        callback(err, data);
      });
    });
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
  var fetchMessages = self.IMAPClient.fetch(start + ':*', { bodies: '', struct: true });

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
      msgs.push({ raw: rawMessage, uid: uid, seqno: seqno });
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
          self.deleteMessage(message.uid, cb);
        };

        msg.uid = message.uid;
        msg.seqNumber = message.seqno;

        cb(null, msg);
      });
    }).parallel();
    getMessages.done(function(messages) {
      callback(null, messages);
    }).fail(callback);
  });
};

module.exports = ImapStore;