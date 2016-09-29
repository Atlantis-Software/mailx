var mailx = require('../../main.js');
var hoodiecrow = require("hoodiecrow-imap");
var assert = require('assert');
var _ = require('underscore');

var options = {
  plugins: ["ID", "SASL-IR", "AUTH-PLAIN", "NAMESPACE", "IDLE", "ENABLE", "CONDSTORE", "XTOYBIRD", "LITERALPLUS", "UNSELECT", "SPECIAL-USE", "CREATE-SPECIAL-USE"],
  id: {
    name: "mailxTestImap",
    version: "0.1"
  },
  users: {
    "login": {
      password: "password"
    }
  },
  storage: {
    "INBOX": {
      messages: [
        {
          raw: "Subject: subject1\r\n\r\n",
          internaldate: "22-Sep-2016 17:20:28 -0300"
        },
        {
          raw: "Subject: subject2\r\n\r\n",
          internaldate: "22-Sep-2016 17:22:22 -0300"
        },
        {
          raw: "Subject: subject3\r\n\r\n",
          internaldate: "22-Sep-2016 18:50:56 -0300"
        }
      ]
    }
  }
};


describe('IMAP', function() {

  var server;
  var store;
  var connection;

  beforeEach(function() {
    server = hoodiecrow(options);
    server.listen(14300);
    store = mailx.store('imap', 'localhost', 14300, 'login', 'password');
    server.outputHandlers.push(function(cnx) {
      connection = cnx;
    });
  });

  afterEach(function(done) {
    store.close(function(err) {
      if (err) {
        return done(err);
      }
      server.close(done);
    });
  });

  it('store.connect() should auth without starttls', function(done) {
    assert(options.plugins.indexOf("STARTTLS") === -1, "server should not use STARTTLS plugin");
    store.connect(function(err) {
      if (err) {
        return done(err);
      }
      assert(connection.secureConnection === false, 'connection shouldn\'t be secure');
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
        assert.equal(messages[0].subject, 'subject1');
        assert.equal(messages[1].subject, 'subject2');
        assert.equal(messages[2].subject, 'subject3');
        done();
      });
    });
  });
});

describe('IMAP STARTTLS', function() {

  var server;
  var tlsOptions = _.clone(options);
  var store;
  var connection;

  beforeEach(function() {
    tlsOptions.plugins = ["ID", "STARTTLS", "SASL-IR", "AUTH-PLAIN", "NAMESPACE", "IDLE", "ENABLE", "CONDSTORE", "XTOYBIRD", "LITERALPLUS", "UNSELECT", "SPECIAL-USE", "CREATE-SPECIAL-USE"];
    server = hoodiecrow(tlsOptions);
    server.listen(14300);
    store = mailx.store('imap', 'localhost', 14300, 'login', 'password');
    server.outputHandlers.push(function(cnx) {
      connection = cnx;
    });
  });

  afterEach(function(done) {
    store.close(function(err) {
      if (err) {
        return done(err);
      }
      server.close(done);
    });
  });

  it('store.connect() should auth using starttls', function(done) {
    assert(tlsOptions.plugins.indexOf("STARTTLS") >= 0, "server should use STARTTLS plugin");
    store.connect(function(err) {
      if (err) {
        return done(err);
      }
      assert(connection.secureConnection === true, 'connection should be secure');
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
        assert.equal(messages[0].subject, 'subject1');
        assert.equal(messages[1].subject, 'subject2');
        assert.equal(messages[2].subject, 'subject3');
        done();
      });
    });
  });

});

describe('IMAPS', function() {

  var server;
  var imapsOptions = _.clone(options);
  var store;
  var connection;

  beforeEach(function() {
    imapsOptions.secureConnection = true;
    server = hoodiecrow(imapsOptions);
    server.listen(9930);
    store = mailx.store('imaps', 'localhost', 9930, 'login', 'password');
    server.outputHandlers.push(function(cnx) {
      connection = cnx;
    });
  });

  afterEach(function(done) {
    store.close(function(err) {
      if (err) {
        return done(err);
      }
      server.close(done);
    });
  });

  it('store.connect() should auth securely without starttls', function(done) {
    assert(imapsOptions.plugins.indexOf("STARTTLS") === -1, "server shouldn\'t use STARTTLS plugin");
    store.connect(function(err) {
      if (err) {
        return done(err);
      }
      assert(connection.secureConnection === true, 'connection should be secure');
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
        assert.equal(messages[0].subject, 'subject1');
        assert.equal(messages[1].subject, 'subject2');
        assert.equal(messages[2].subject, 'subject3');
        done();
      });
    });
  });

});