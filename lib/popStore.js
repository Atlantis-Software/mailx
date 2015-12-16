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
  this.POP3Client.connect(function(err,data) {
    if (err) {
      return callback(err);
    }
    this.status = STATE.CONNECTED;
    self.POP3Client.stls(function(err, rawdata){
      if (err) {
        self.POP3Client.quit();
        return callback(err);
      }
      self.POP3Client.login(self.login, self.password, function(err,rawdata){
          if (err) {
            self.POP3Client.quit();
            return callback(err);
          }
          self.status = STATE.LOGGED_IN;
          callback(null, rawdata);
        });
    });
  });
};

PopStore.prototype.close = function() {
  this.status = STATE.CLOSED;
  this.POP3Client.quit();
};

PopStore.prototype.getInboxMessages = function (start, callback) {
  var self = this;
 
  self._list(start, function (err, list) {
    if (err) {
      return callback(err);
    }
    var inbox = asynk.each(list,function(seqno,cb){
        self.POP3Client.retr(seqno,function(err,rawMessage){
          if (err) {
            return cb(err);
          }
          cb(null,{raw: rawMessage, uid: null, seqno: parseInt(seqno, 10)});
        });
    }).serie();
    inbox.fail(callback);
    inbox.done(function(messages){
      var parsedMessages = asynk.each(messages,function(message,cb){
        Message.createFromRaw(message.raw, function(err,msg){
          if (err) {
            return cb(err);
          }
          msg.delete = function(cb) {
            if (self.status !== STATE.LOGGED_IN) {
              return cb(new Error('NOT LOGGED IN!'));
            }
            self.deleteMessage(message.seqno,cb);
          };

          msg.uid = message.uid;
          msg.seqNumber = message.seqno;

          cb(null,msg);
        });
      }).parallel();
      parsedMessages.fail(callback);
      parsedMessages.done(function(messages){
        callback(null,messages);
      });
    });
  });
};

PopStore.prototype.deleteMessage = function(seqno, callback) {
    this.POP3Client.dele(seqno, callback);
};

PopStore.prototype._list = function(start, callback) {
    var callback = callback || function() {};
    this.POP3Client.list(null,function(err, list) {
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