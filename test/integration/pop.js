var mailx = require('../../main.js');
var popServer = require("pop-server");
var assert = require('assert');
var _ = require('underscore');
var fs = require('fs');
var path = require('path');
var mailcomposer = require("mailcomposer");


var server;
var store;
var connection;
var uids = ['msg_1', 'msg_2', 'msg_3'];

var options = {
  auth: function(user, checkPassword) {
    var password = false;
    if (user === 'login') {
      password = 'password';
    }
    return checkPassword(password);
  },
  store: {
    register: function(cb) {
      connection = this.connection;
      if (this.user === "login") {
        var self = this;
        uids.forEach(function(uid) {
          self.addMessage(uid, 40);
        });
      }
      cb();
    },
    read: function(uid, cb) {
      var message = mailx.message();
      message.setFrom('me', 'me@example.net');
      message.addTo('you', 'you@example.net');
      message.setSubject('hello');
      message.setText('hi ! how are u?');
      message.setHtml('hi ! how are u? <b>hugs</b>');
      mailcomposer(message).build(cb);
    },
    removeDeleted: function(deleted, cb) {
      deleted.forEach(function(uid) {
        var index = uids.indexOf(uid);
        if (index > -1) {
          uids.splice(index, 1);
        }
      });
      cb();
    }
  }
};

describe('POP3', function() {

  before(function() {
    server = new popServer(options);
    server.listen(11000);
  });

  after(function(done) {
    server.close(done);
  });

  beforeEach(function() {
    store = mailx.store('pop3', 'localhost', 11000, 'login', 'password');
  });

  afterEach(function(done) {
    store.close(function(err) {
      if (err) {
        return done(err);
      }
      done();
    });
  });

  it('store.connect() should auth without starttls', function(done) {
    store.connect(function(err) {
      if (err) {
        return done(err);
      }
      assert.equal(!!connection.secure, false, 'connection shouldn\'t be secure');
      done();
    });
  });

  it('store.getInboxMessages() should receive all messages from inbox', function(done) {
    store.connect(function(err) {
      if (err) {
        return done(err);
      }
      store.getInboxMessages(0, function(err, messages) {
        if (err) {
          return done(err);
        }
        assert(messages.length === 3, 'should receive 3 messages from inbox');
        assert.equal(messages[0].subject, 'hello');
        done();
      });
    });
  });
});

describe('POP3 STARTTLS', function() {

  before(function() {
    var tlsOptions = _.clone(options);
    tlsOptions.tls = {
      key: fs.readFileSync(path.join(__dirname, '../../node_modules/pop-server/cert/privatekey.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../../node_modules/pop-server/cert/certificate.pem'))
    };
    server = new popServer(tlsOptions);
    server.listen(11000);
  });

  after(function(done) {
    server.close(done);
  });

  beforeEach(function() {
    store = mailx.store('pop3', 'localhost', 11000, 'login', 'password');
  });

  afterEach(function(done) {
    store.close(function(err) {
      if (err) {
        return done(err);
      }
      done();
    });
  });

  it('store.connect() should auth using starttls', function(done) {
    store.connect(function(err) {
      if (err) {
        return done(err);
      }
      assert(connection.secure === true, 'connection should be secure');
      done();
    });
  });

  it('store.getInboxMessages() should receive all messages from inbox', function(done) {
    store.connect(function(err) {
      if (err) {
        return done(err);
      }
      store.getInboxMessages(0, function(err, messages) {
        if (err) {
          return done(err);
        }
        assert(messages.length === 3, 'should receive 3 messages from inbox');
        assert.equal(messages[0].subject, 'hello');
        done();
      });
    });
  });

});

describe('POP3S', function() {

  before(function() {
    var tlsOptions = _.clone(options);
    tlsOptions.tls = {
      key: fs.readFileSync(path.join(__dirname, '../../node_modules/pop-server/cert/privatekey.pem')),
      cert: fs.readFileSync(path.join(__dirname, '../../node_modules/pop-server/cert/certificate.pem'))
    };
    server = new popServer(tlsOptions);
    server.listenSSL(14300);
  });

  after(function(done) {
    server.close(done);
  });

  beforeEach(function() {
    store = mailx.store('pop3s', 'localhost', 14300, 'login', 'password');
  });

  afterEach(function(done) {
    store.close(function(err) {
      if (err) {
        return done(err);
      }
      done();
    });
  });

  it('store.connect() should auth securely without starttls', function(done) {
    store.connect(function(err) {
      if (err) {
        return done(err);
      }
      assert(connection.secure === true, 'connection should be secure');
      done();
    });
  });

  it('store.getInboxMessages() should receive all messages from inbox', function(done) {
    store.connect(function(err) {
      if (err) {
        return done(err);
      }
      store.getInboxMessages(0, function(err, messages) {
        if (err) {
          return done(err);
        }
        assert(messages.length === 3, 'should receive 3 messages from inbox');
        assert.equal(messages[0].subject, 'hello');
        done();
      });
    });
  });

});