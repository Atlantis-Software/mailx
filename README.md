Mailx
-------

mailx is a simple and complete email client library (pop, imap and smtp) for nodejs. 

----------

<i class="icon-pencil"></i> Write and send an Email
---------------------------------------------------

#### <i class="icon-file"></i> Message objet
the message object is used to write or read a message.

**Sample:** write a new message
```javascript
var message = mailx.message();
message.setFrom('me', 'me@my-domain.com');
message.addTo('you', 'you@your-domain.com');
message.setSubject('hello');
message.setText('hi ! how are u?');
```
#### <i class="icon-upload"></i> Transport object
the transport objet is used to send a predefined message.

**Sample:** sending a message
```javascript
var transport = mailx.transport('smtp.host.com', 25, 'login', 'password');
transport.send(message, function(err,result) {
    console.log(result);
});
```

<i class="icon-download"></i> Receive Email
-------------------------------------------

<i class="icon-download"></i> Store object

**Sample:** get all message from server, log their subjets and delete the last one
```javascript
var store = mailx.store('pop3', 'pop.host.com', 110, 'login', 'password');
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
