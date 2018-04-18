Mailx
-------

[![npm version](https://badge.fury.io/js/mailx.svg)](https://www.npmjs.com/mailx)
[![Build Status](https://travis-ci.org/Atlantis-Software/mailx.svg?branch=master)](https://travis-ci.org/Atlantis-Software/mailx)
[![Coverage Status](https://coveralls.io/repos/github/Atlantis-Software/mailx/badge.svg?branch=master)](https://coveralls.io/github/Atlantis-Software/mailx?branch=master)
[![NSP Status](https://nodesecurity.io/orgs/atlantis/projects/197e1a87-263d-4dec-90d7-4e1850240fc4/badge)](https://nodesecurity.io/orgs/atlantis/projects/197e1a87-263d-4dec-90d7-4e1850240fc4)
[![Dependencies Status](https://david-dm.org/Atlantis-Software/mailx.svg)](https://david-dm.org/Atlantis-Software/mailx)

mailx is a simple and complete email client library (pop, imap and smtp) for nodejs. 

----------

<i class="icon-pencil"></i> Write and send an Email
---------------------------------------------------

#### <i class="icon-file"></i> Message objet
the message object is used to write or read a message.

**Sample:** write a new message
```javascript
var message = mailx.message();
message.setFrom('me', 'me@example.net');
message.addTo('you', 'you@example.net');
message.setSubject('hello');
message.setText('hi ! how are u?'); 
message.setHtml('hi ! how are u? <b>hugs</b>');
```
#### <i class="icon-upload"></i> Transport object
the transport objet is used to send a predefined message.

**Sample:** sending a message
```javascript
var transport = mailx.transport('smtp.example.net', 25, 'login', 'password');
transport.send(message, function(err,result) {
    console.log(result);
});
```

<i class="icon-download"></i> Receive Email
-------------------------------------------

<i class="icon-download"></i> Store object

**Sample:** get all messages from server, log their subjets and delete the last one
```javascript
var store = mailx.store('pop3', 'pop.example.net', 110, 'login', 'password');
store.connect(function(err) {
  if (err) {
    return console.log('connect error', err);
  }
  store.getInboxMessages(0, function(err, messages) {
    if (err) {
      return console.log('inbox error', err);
    }
    messages.forEach(function(message,index) {
      console.log(message.subject);
      if (index === messages.length - 1) {
        message.delete(function(err, data) {
          console.log('message deleted!', data);
          store.close(function(err, data) {
            console.log('store.close err:', err);
          });
        });
      }
    });
  });
});
```

**Sample:** get message by message from server and log their subjets
```javascript
var store = mailx.store('imap', 'imap.example.net', 143, 'login', 'password');
store.connect(function(err) {
  if (err) {
    return console.log('err connect: ', err);
  }
  var inbox = store.getInbox(1);
  inbox.fail(function(err){
    console.log('fail get messages: ', err);
  });
  inbox.done(function(status){  
    console.log('end of inbox');
  });
  (function recursiveRcpt() {
    inbox.getNextMessage(function(err, message) {
      if (err) {
        return console.log('fail get message: ', err);
      }
      if (message === null) {
        return console.log('no more message to read');
      }
      console.log(message.subject);
      recursiveRcpt();
    });
  })();
});
```

