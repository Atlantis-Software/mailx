Mailx
-------

mailx is an unified set of POP,IMAP and SMTP clients.

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

**Sample:** get all message from server and log their subjets
```javascript
var store = mailx.store('pop3', 'pop.host.com', 110, 'login', 'password');
var callback = function(err, messages, box){
	store.close();
};
var handler = function(err, message){
	if (!err) {
		console.log(message.subjet);
	}
};
store.getInboxMessages(0, handler, callback);
```
