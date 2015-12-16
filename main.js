
var Transport = require("./lib/transport");
var Store = require("./lib/store");
var Message = require("./lib/message");


module.exports = {
    transport: function(host, port, login, password) {
        return new Transport(host, port, login, password);
    },
    store: function(protocol, host, port, login, password, options) {
        return new Store(protocol, host, port, login, password, options);
    },
    message: Message.create,
    parse: Message.createFromRaw
};


