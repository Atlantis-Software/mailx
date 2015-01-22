
var Message = require('./message');
var asynk = require('asynk');
var _ = require('underscore');
var util = require('util');
var EventEmitter = require('events').EventEmitter;
var inspect = require('util').inspect;

var Store = function(protocol, host, port, login, password) {
    this.flags = {deleted: []};
    this.protocol = protocol;
    this.host = host;
    this.port = port;
    this.login = login;
    this.password = password;
};
Store.prototype = Object.create(require('events').EventEmitter.prototype);

Store.prototype.connect = function(callback) {
    switch (this.protocol) {
        case "pop3":
            this.popcon(this.host, this.port, false, this.login, this.password, callback);
            break;
        case "pop3s":
            this.popcon(this.host, this.port, true, this.login, this.password, callback);
            break;
        case "imap":
            this.imapcon(this.host, this.port, false, this.login, this.password, callback);
            break;
        case "imaps":
            this.imapcon(this.host, this.port, true, this.login, this.password, callback);
            break;
        default:
            callback("UNKNOWN PROTOCOL", null);
    }
};

Store.prototype.endConnection = function() {
    switch (this.protocol) {
        case "pop3":
        case "pop3s":
            this.popClose();
            break;
        case "imap":
        case "imaps":
            this.imapClose();
            break;
        default:
            callback("UNKNOWN PROTOCOL", null);
    }
};

Store.prototype.close = function() {
    var self = this;
    var operationsNumber = self.flags.deleted.length;
    if (self.flags.deleted) {
        if (operationsNumber > 0) {
            asynk.each(self.flags.deleted, function(toDelete, nextToDelete) {
                self.deleteMessage(toDelete, function(err, message) {
                    nextToDelete();
                });
            }).args(asynk.item, asynk.callback).serie(function(err) {
                self.endConnection();
            });
        } else {
            self.endConnection();
        }
    } else
        self.endConnection();
};

Store.prototype.getInboxMessages = function(start, logic, callback) {
    var self = this;
    switch (this.protocol) {
        case "pop3":
        case "pop3s":
            self.popList(start, '*', function(err, list, boxInfo) {
                if (!err) {
                    self.popRetreiveMultiple(boxInfo, list, logic, callback);
                }
            });
            break;
        case "imap":
        case "imaps":
            self.openInbox(function(err, box) {
                if (!err) {
                    self.imapFetch(box, start, '*', true, logic, callback); //true to retreive messages with uid in interval [start, end], false to retreive by seq numbers
                } else {
                    callback('ERROR OPENING BOX', null, null);
                }
            });
            break;
        default:
            callback("UNKNOWN PROTOCOL", null, null);
    }
};

Store.prototype.deleteMessage = function(message, callback) {
    switch (this.protocol) {
        case "pop3":
        case "pop3s":
            this.popDeleteMessage(message, callback);
            break;
        case "imap":
        case "imaps":
            this.imapDeleteMessage(message, callback);
            break;
        default:
            callback("UNKNOWN PROTOCOL");
    }
};

Store.prototype.popcon = function(host, port, tls, login, password, callback) {
    var POP3Client = require("poplib");
    this.POP3Client = new POP3Client(port, host, {
        ignoretlserrs: true,
        enabletls: tls,
        debug: false
    });

    this.POP3Client.on("error", function(err) {
        callback(err, null);
        this.quit();
    });

    this.POP3Client.on("connect", function(status, rawdata) {
        if (status) {
            this.stls();
        } else {
            callback("CONNECT failed because " + rawdata, null);
            return;
        }
    });

    this.POP3Client.on("stls", function(status, rawdata) {
        this.login(login, password);
    });

    this.POP3Client.on("login", function(status, rawdata) {
        if (status) {
            callback(null, rawdata);
        }
        else {
            callback("LOGIN failed because " + rawdata, null);
            this.quit();
        }
    });
};

Store.prototype.popUidList = function(start, end, uidMode, callback) {
    var callback = callback || function() {
    };
    var total = 0;
    this.POP3Client.once("uidl", function(status, msgcount, msgnumber, data, rawdata) {
        if (status === false) {
            callback("could not list pop account", null);

        } else {
            var msgUids = data.split('\r\n');
            callback(null, _.compact(_.map(msgUids, function(item) {
                var verif;
                var splittedItem = item.split(' ');
                if (splittedItem.length !== 2)
                    return null;
                var seqno = Number(splittedItem[0]);
                var uid = parseInt(splittedItem[1], 16);
                if (uidMode) {
                    if ((end === '*' || uid <= end) && uid >= start)
                        verif = true;
                }
                else if ((end === '*' || seqno <= end) && seqno >= start)
                    verif = true;
                if (verif)
                    return {seqNumber: seqno, uid: uid};
                return null;

            })), {total: msgUids.length - 1, new : -1});
        }
    });
    this.POP3Client.uidl();
};

Store.prototype.popList = function(start, end, callback) {
    var callback = callback || function() {
    };
    this.POP3Client.once("list", function(status, msgcount, msgnumber, data, rawdata) {
        if (status === false) {
            callback("#could not list pop account", null, null);

        } else {
            var indexes = _.map(_.keys(data), function(key) {//converting keys from string to int
                return parseInt(key, 10);
            });
            var filtredIndexes = _.filter(indexes, function(seqNo) {
                return seqNo >= start && (end === '*' || end >= seqNo);
            });
            callback(null, filtredIndexes, {total: indexes.length, new : -1});
        }
    });
    this.POP3Client.list();
};

Store.prototype.popRetreiveMultipleByUid = function(boxInfo, list, logic, callback) {
    var self = this;
    asynk.each(list, function(msg, nextMsg) {
        self.popRetr(msg.uid, msg.seqNumber, function(err, message) {
            logic(err, message);
            if (message.markedAsDeleted)
                self.flags.deleted.push(message);
            nextMsg();
        });
    }).args(asynk.item, asynk.callback).serie(function(err, data) {
        if (!err)
            callback(null, data, boxInfo);
        else
            callback(err, null, null);
    }, [null, asynk.data('all')]);
};

Store.prototype.popRetreiveMultiple = function(boxInfo, list, logic, callback) {
    var self = this;
    var messages = [];
    asynk.each(list, function(seqNo, nextSeqNo) {
        self.popRetr(seqNo, function(err, message) {
            messages.push(message);
            logic(err, message);
            if (message.markedAsDeleted)
                self.flags.deleted.push(message);
            nextSeqNo();
        });
    }).args(asynk.item, asynk.callback).serie(function(err, data) {
        if (!err)
            callback(null, messages, boxInfo);
        else
            callback(err, null, null);
    }, [null, asynk.data('all')]);
};

Store.prototype.popRetrByUid = function(uid, seqNumber, callback) {
    var self = this;
    this.POP3Client.once("retr", function(status, msgnumber, data, rawdata) {
        if (status === true) {
            Message.createFromRaw(data, uid, seqNumber, function(err, parsedMessage) {
                if (!err) {
                    parsedMessage.seqNumber = seqNumber;
                    parsedMessage.uid = uid;
                    callback(null, parsedMessage);
                }
                else
                    callback(err, null);
            });
        } else {
            callback("could not list pop account", null);
        }
    });
    this.POP3Client.retr(seqNumber);
};

Store.prototype.popRetr = function(seqNumber, callback) {
    var self = this;
    this.POP3Client.once("retr", function(status, msgnumber, data, rawdata) {
        if (status === true) {
            Message.createFromRaw(data, null, seqNumber, function(err, parsedMessage) {
                if (!err) {
                    parsedMessage.seqNumber = seqNumber;
                    callback(null, parsedMessage);
                }
                else
                    callback(err, null);
            });
        } else {
            callback("could not list pop account", null);
        }
    });
    this.POP3Client.retr(seqNumber);
};

Store.prototype.popGetSeqNumberByUid = function(uid, callback) {
    this.POP3Client.once("uidl", function(status, msgcount, msgnumber, data, rawdata) {
        if (status === false) {
            callback("could not list pop account", null);

        } else {
            var msgUids = data.split('\r\n');
            var uidList = _.compact(_.map(msgUids, function(item) {
                var verif;
                var splittedItem = item.split(' ');
                if (splittedItem.length !== 2)
                    return null;
                var seqno = Number(splittedItem[0]);
                var uid = parseInt(splittedItem[1], 16);
                return {seqNumber: seqno, uid: uid};

            }));
            var uidObject = _.findWhere(uidList, {uid: uid});
            if (uidObject)
                callback(null, uidObject.seqNumber);
            else
                callback(null, null);
        }
    });
    this.POP3Client.uidl();
};


Store.prototype.popDeleteMessageByUid = function(message, callback) {
    var self = this;
    this.POP3Client.on("dele", function(status, msgcount, response) {
        if (status) {
            callback(null, message);
        }
        else {
            callback('Error deleting message number (' + message.seqNumber + ') ||' + response, null);
        }
    });
    self.popGetSeqNumberByUid(message.uid, function(err, seqNumberToDelete) {
        if (!err)
            self.POP3Client.dele(seqNumberToDelete);
        else {
            console.log(err);
            callback(err, null);
        }
    });
};

Store.prototype.popDeleteMessage = function(message, callback) {
    var self = this;
    this.POP3Client.on("dele", function(status, msgNumber, response) {
        if (status) {
            callback(null, null);
        }
        else {
            console.log(status, msgNumber, response);
            callback('  #(POP3) Error deleting message number (' + message.seqNumber + ')', null);
        }
    });
    self.POP3Client.dele(message.seqNumber);
};

Store.prototype.popClose = function() {
    this.POP3Client.quit();
};

Store.prototype.imapcon = function(host, port, tls, login, password, callback) {
    var self = this;
    var Imap = require('imap');
    this.IMAPClient = new Imap({
        user: login,
        password: password,
        host: host,
        port: port,
        tls: tls,
        autotls: 'always',
        tlsOptions: {rejectUnauthorized: false}//,debug :console.log
    });
    this.IMAPClient.once('error', function(err) {
        this.end();
        callback(err, null);
    });
    this.IMAPClient.once('ready', function() {
        callback(null, null);
    });
    this.IMAPClient.once('end', function() {
    });
    this.IMAPClient.connect();
};

Store.prototype.openInbox = function(cb) {
    this.IMAPClient.openBox('INBOX', false, cb);//true => readOnlyMode
};

Store.prototype.imapFetch = function(box, start, end, byUidMode, logic, callback) {
    var self = this;
    var received = 0, parsed = 0;
    var messages = [];
    if (!start)
        start = 1;
    var numberToReceive = 0;
    var interval = start + ':' + end;
    var fetchMessages;
    if (byUidMode)
        fetchMessages = self.IMAPClient.fetch(interval, {bodies: '', struct: true, size:true});
    else
        fetchMessages = self.IMAPClient.seq.fetch(interval, {bodies: '', struct: true, size:true});
    fetchMessages.on('message', function(msg, seqno) {
        if (!numberToReceive) {
            numberToReceive = (box.messages.total - seqno) + 1;
        }
        var rawMessage = '';
        var uid,messageFlags,size;
        msg.on('body', function(stream, info) {
            var buffer = '';
            stream.on('data', function(chunk) {
                buffer += chunk.toString('utf8');
            });
            stream.once('end', function() {
                rawMessage += buffer;
            });
        });
        msg.once('attributes', function(attrs) {
            uid = attrs.uid;
            messageFlags = attrs.flags;
            size = attrs.size;
        });
        msg.once('end', function() {
            received++;
            Message.createFromRaw(rawMessage, uid, seqno, function(err, newMsg) {
                if (!err) {
                    newMsg.flags = messageFlags;
                    newMsg.size = size;
                    messages.push(newMsg);
                    logic(null, newMsg);
                    if (newMsg.markedAsDeleted)
                        self.flags.deleted.push(newMsg);
                    parsed++;
                    if (parsed === numberToReceive) {
                        callback(null, messages, box.messages);
                    }
                }
                else
                    logic(err, null);
            });
        });
    });
    fetchMessages.once('error', function(err) {
        callback(err, null, null);
    });
    fetchMessages.once('end', function() {
        if (!numberToReceive) {
            callback(null, [], box.messages);
        }
    });
};


Store.prototype.imapDeleteMessage = function(message, callback) {
    var self = this;
    self.IMAPClient.addFlags(message.uid, 'DELETED', function(err) {
        if (err)
            return callback(err);
        callback(null);
    });
};

Store.prototype.imapClose = function() {
    var self = this;
    self.IMAPClient.closeBox(true, function(err) {//true for autoExpunge
        if (err)
            console.log(err);
        else {
            self.IMAPClient.end();
        }
    });
};

module.exports = Store;
