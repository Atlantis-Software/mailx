var mailx = require('../../main.js');
var assert = require('assert');
var SMTPServer = require('smtp-server').SMTPServer;

var message = mailx.message();
message.setFrom('me', 'me@my-domain.com');
message.addTo('you', 'you@your-domain.com');
message.setSubject('subject');
message.setText('text');

describe('SMTP', function() {
  it('should send a mail via smtp', function(done) {
    var server = new SMTPServer({
      onAuth: function(auth, session, callback) {
        if (auth.username !== 'login' || auth.password !== 'password') {
          return callback(new Error('Invalid username or password'));
        }
        callback(null, { user: 1 });
      },
      onData: function(stream, session, callback) {
        var data = "";
        stream.on('data', function(chunk) {
          data += chunk;
        });
        stream.on('end', function() {
          mailx.parse(data, function(err, mail) {
            if (err) {
              return assert(false, "mail couldn't be parsed");
            }
            assert.equal(mail.from.address, 'me@my-domain.com');
            assert.equal(mail.to[0].address, 'you@your-domain.com');
            assert.equal(mail.subject, 'subject');
            callback(null, "message queued");
          });
        });
      }
    });

    server.listen(25000);

    var transport = mailx.transport('localhost', 25000, 'login', 'password');
    transport.send(message, function(err, result) {
      if (err) {
        return done(err);
      }
      done();
    });
  });
});
