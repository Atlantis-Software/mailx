var POP3Client = require("./poplib");
var Message = require('./message');
var asynk = require('asynk');
var _ = require('underscore');
var util = require('util');
var inspect = require('util').inspect;

var STATE = {
  'CLOSED': 0,
  'CONNECTING': 1,
  'CONNECTED': 3,
  'LOGGED_IN': 4
};

var PopStore = function() {
  this.status = null;
};

PopStore.prototype.connect = function(callback) {
  var self = this;
  this.POP3Client = new POP3Client(this.port, this.host, {
    ignoretlserrs: true,
    enabletls: self.tls,
    debug: false
  });
  this.status = STATE.CONNECTING;
  this.POP3Client.connect(function(err, data) {
    if (err) {
      return callback(err);
    }
    this.status = STATE.CONNECTED;
    self._capa(function(err, capa) {
      if (err) {
        // if server has no CAPA command, try simple login
        return self._login(callback);
      }
      // check if server has STLS capability
      if (capa.STLS) {
        self.POP3Client.stls(function(err, rawdata) {
          if (err) {
            self.POP3Client.quit();
            return callback(err);
          }
          self._login(callback);
        });
      } else {
        self._login(callback);
      }
    });
  });
};

PopStore.prototype._capa = function(callback) {
  this.POP3Client.capa(function(err, capa) {
    if (err) {
      return callback(err);
    }
    var lines = capa.split("\r\n");
    var capabilities = {};
    lines.forEach(function(line) {
      let capability = line.match(/^[A-Za-z\-]+/);
      if (!capability) {
        return;
      }
      let params = capability && line.substr(capability[0].length + 1).trim();
      capability = capability[0].toUpperCase();
      if (capability === "IMPLEMENTATION") {
        return capabilities[capability] = params;
      }
      if (params === "") {
        return capabilities[capability] = true;
      }
      params = (params || "").split(" ");
      params.forEach(function(param, index) {
        params[index] = param.trim().toUpperCase();
      });
      capabilities[capability] = params;
    });
    callback(null, capabilities);
  });
};

PopStore.prototype._login = function(callback) {
  var self = this;
  self.POP3Client.login(self.login, self.password, function(err, rawdata) {
    if (err) {
      self.POP3Client.quit();
      self.status = STATE.CLOSED;
      return callback(err);
    }
    self.status = STATE.LOGGED_IN;
    callback(null, rawdata);
  });
};

PopStore.prototype.close = function(callback) {
  try {
    this.status = STATE.CLOSED;
    this.POP3Client.quit();
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

PopStore.prototype.getInboxMessages = function(start, callback) {
  var self = this;

  self._list(start, function(err, list) {
    if (err) {
      return callback(err);
    }
    var inbox = asynk.each(list, function(seqno, cb) {
      self.POP3Client.retr(seqno, function(err, rawMessage) {
        if (err) {
          return cb(err);
        }
        cb(null, { raw: rawMessage, uid: null, seqno: parseInt(seqno, 10) });
      });
    }).serie();
    inbox.fail(callback);
    inbox.done(function(messages) {
      var parsedMessages = asynk.each(messages, function(message, cb) {
        Message.createFromRaw(message.raw, function(err, msg) {
          if (err) {
            return cb(err);
          }
          msg.delete = function(cb) {
            if (self.status !== STATE.LOGGED_IN) {
              return cb(new Error('NOT LOGGED IN!'));
            }
            self.deleteMessage(message.seqno, cb);
          };

          msg.uid = message.uid;
          msg.seqNumber = message.seqno;

          cb(null, msg);
        });
      }).parallel();
      parsedMessages.fail(callback);
      parsedMessages.done(function(messages) {
        callback(null, messages);
      });
    });
  });
};

PopStore.prototype.getInbox = function(start) {
  var defer = asynk.deferred();
  this.inboxMessagesQueue = [];
  this.getNextMessageQueue = [];
  this._end = false;
  var self = this;

  self._list(start, function(err, list) {
    if (err) {
      return defer.reject(err);
    }
    if (!list.length) {
      self._end = true;
      for (var i = 0; i < self.getNextMessageQueue.length; i++) {
        var cb = self.getNextMessageQueue.shift();
        cb(null, null);
      }
      return defer.resolve({ received: 0 });
    }
    var inbox = asynk.each(list, function(seqno, cb) {
      self.POP3Client.retr(seqno, function(err, rawMessage) {
        if (err) {
          return cb(err);
        }
        Message.createFromRaw(rawMessage, function(err, msg) {
          if (err) {
            return cb(err);
          }
          msg.delete = function(cb) {
            if (self.status !== STATE.LOGGED_IN) {
              return cb(new Error('NOT LOGGED IN!'));
            }
            self.deleteMessage(seqno, cb);
          };
          msg.uid = null;
          msg.seqNumber = seqno;
          defer.notify(msg);
          // if no waiting getNextMessage in queue then push message in inboxMessagesQueue
          if (self.getNextMessageQueue.length === 0) {
            self.inboxMessagesQueue.push(msg);
          } else {
            var NextMessageCb = self.getNextMessageQueue.shift();
            NextMessageCb(null, msg);
          }
          cb();
        });
      });
    }).serie().fail(function(err) {
      defer.reject(err);
    }).done(function() {
      self._end = true;
      defer.resolve({ received: list.length });
    });
  });

  return defer.promise({
    close: function(cb) {
      cb = cb || function() { };
      self.close();
      cb();
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

PopStore.prototype.deleteMessage = function(seqno, callback) {
  this.POP3Client.dele(seqno, callback);
};

PopStore.prototype._list = function(start, callback) {
  var callback = callback || function() { };
  this.POP3Client.list(null, function(err, list) {
    if (err) {
      return callback(new Error('Could not list inbox'));
    }
    var filtredIndexes = _.filter(_.keys(list), function(seqNo) {
      return parseInt(seqNo, 10) >= start;
    });
    callback(null, filtredIndexes);
  });
};

module.exports = PopStore;