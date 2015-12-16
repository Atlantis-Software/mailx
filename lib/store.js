var ImapStore = require('./imapStore');
var PopStore = require('./popStore');

var Store = function(protocol, host, port, login, password) {
    var str = {};
    if (protocol === 'imap' || protocol === 'imaps') {
      str = new ImapStore();
    } else if (protocol === 'pop' || protocol === 'pop3' || protocol === 'pop3s') {
      str = new PopStore();
    }
    str.host = host;
    str.port = port;
    str.login = login;
    str.password = password;
    if (protocol === 'imaps' || protocol === 'pop3s') {
      str.tls = true;
    }
    return str;
};

module.exports = Store;