/*
 
 Node.js POP3 client library
 
 Copyright (C) 2011-2013 by Ditesh Shashikant Gathani <ditesh@gathani.org>
 Copyright (C) 2015 by Tiertant Alexandre
 
 Permission is hereby granted, free of charge, to any person obtaining a copy
 of this software and associated documentation files (the "Software"), to deal
 in the Software without restriction, including without limitation the rights
 to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 copies of the Software, and to permit persons to whom the Software is
 furnished to do so, subject to the following conditions:
 
 The above copyright notice and this permission notice shall be included in
 all copies or substantial portions of the Software.
 
 THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 THE SOFTWARE.
 
 */

var net = require("net");
var tls = require("tls");
var util = require("util");
var crypto = require("crypto");

// Constructor
function POP3Client(port, host, options) {

  var options = options || {};

  // Optional constructor arguments
  var enabletls = options.enabletls || false;
  var ignoretlserrs = options.ignoretlserrs || false;
  this.debug = options.debug || false;

  // Private variables follow
  var self = this;
  var state = 0;
  var locked = false;
  var multiline = false;
  var socket = null;
  
  // Public variables follow
  this.data = {
    host: host,
    port: port,
    banner: "",
    stls: false,
    apop: false,
    username: "",
    tls: enabletls,
    ignoretlserrs: ignoretlserrs
  };

  // Privileged methods follow
  this.setState = function (val) {
    state = val;
  };
  this.getState = function () {
    return state;
  };
  this.setLocked = function (val) {
    locked = val;
  };
  this.getLocked = function () {
    return locked;
  };
  this.setMultiline = function (val) {
    multiline = val;
  };
  this.getMultiline = function () {
    return multiline;
  };

  // Writes to remote server socket
  this.write = function (command, argument, cb) {
    if (this.getLocked() === true) {
      return cb(new Error("locked"));
    }
    this.setLocked(true);
    var cb = cb || function() {};
    var text = command;
    if (argument) {
      text = text + " " + argument + "\r\n";
    } else {
      text = text + "\r\n";
    }
    if (this.debug) {
      console.log("Client: " + util.inspect(text));
    }
    
    var bufferedData = "";
    var checkResp = true;
    var err = null;
    var detach = function() {
      socket.removeAllListeners("data");
      socket.removeAllListeners("error");
      socket.removeAllListeners("close");      
    };
    
    socket.on("data", function(data){
      var data = data.toString("ascii");
      bufferedData += data;

      if (self.debug) {
        console.log("Server: " + util.inspect(data));
      }

      if (checkResp === true) {

        if (bufferedData.substr(0, 3) === "+OK") {
          checkResp = false;
          err = null;

        } else if (bufferedData.substr(0, 4) === "-ERR") {
          checkResp = false;
          err = new Error(bufferedData);

          // The following is only used for SASL
        } else if (multiline === false) {
          checkResp = false;
          err = null;
        }
      }

      if (checkResp === false) {

        if ((multiline === true && (err || bufferedData.substr(bufferedData.length - 5) === "\r\n.\r\n")) || (multiline === false)) {
          multiline = false;
          self.setLocked(false);
          detach();
          cb(err, bufferedData);
        }
      }      
    });
    socket.on("error", function(err){
      detach();
      cb(err);
    });
    
    socket.on("close", function(){
      detach();
      cb(new Error('Close'));
    }); 

    if (socket) {
      socket.write(text);
    } else {
      cb(new Error('Null Socket Error'));
    }
  };

  // Kills the socket connection
  this.end = function () {
    socket.end();
  };

  // Upgrades a standard unencrypted TCP connection to use TLS
  // Liberally copied and modified from https://gist.github.com/848444
  // starttls() should be a private function, but I can't figure out
  // how to get a public prototypal method (stls) to talk to private method (starttls)
  // which references private variables without going through a privileged method
  this.starttls = function (cb, options) {
    var self = this;
    var cb = cb || function() {};
    var s = socket;
    socket.removeAllListeners("end");
    socket.removeAllListeners("data");
    socket.removeAllListeners("error");
    socket = null;

    var sslcontext = require('crypto').createCredentials(options);
    var pair = tls.createSecurePair(sslcontext, false);

    pair.encrypted.pipe(s);
    s.pipe(pair.encrypted);

    pair.fd = s.fd;
    var cleartext = pair.cleartext;
    cleartext.socket = s;
    cleartext.encrypted = pair.encrypted;
    cleartext.authorized = false;
    cleartext._controlReleased = true;

    function onerror(e) {
      if (cleartext._controlReleased)
        cleartext.emit('error', e);
    }

    function onclose() {
      s.removeListener('error', onerror);
      s.removeListener('close', onclose);
    }

    s.on('error', onerror);
    s.on('close', onclose);
    
    

    pair.on('error', function (err) {
      if (this.debug) {
        console.log('TLS Error:',err);
      }
      if (!self.data.ignoretlserrs) {
        cb(err);
        cb = function() {};
      }
    });

    pair.on('secure', function () {

      var sslError = pair.ssl.verifyError();
      cleartext.authorized = true;

      if (sslError) {
        cleartext.authorized = false;
        cleartext.authorizationError = sslError;
      }
      pair.removeListener('error', onerror);
      socket = cleartext; 
      cb(sslError);
    });
  };

  this.connect = function(cb) {
    var self = this;

    if (enabletls === true) {
      var tlssock = tls.connect({
        host: host,
        port: port,
        rejectUnauthorized: !self.data.ignoretlserrs
      }, function() {
        if (tlssock.authorized === false) {
          if (self.debug) {
            console.log('TLS Error:', tlssock.authorizationError);
          }
          if (self.data["ignoretlserrs"] === false) {
            connectCb(tlssock.authorizationError);
          }
        }

      });

      socket = tlssock;

    } else {
      socket = new net.createConnection(port, host);
    }
    socket.on("data", function(data){
      socket.removeAllListeners("data");
      var data = data.toString();
      if (data.substr(0, 3) !== "+OK") {
        return cb(new Error('Server respond ' + data));
      } else {
        // Checking for APOP support
        var banner = data.trim();
        var bannerComponents = banner.split(" ");

        for (var i = 0; i < bannerComponents.length; i++) {

          if (bannerComponents[i].indexOf("@") > 0) {

            self.data["apop"] = true;
            self.data["apop-timestamp"] = bannerComponents[i];
            break;

          }
        }

        state = 1;
        self.data["banner"] = banner;
        cb(null,data);
      }      
    });
    socket.on("end", function(data){     
      self.setState(0);
      socket = null;
    });
  };
};

POP3Client.prototype.login = function (username, password, cb) {
  var self = this;
  if (self.getState() !== 1) {
    return cb(new Error("invalid-state"));
  }
  self.setMultiline(false);
  self.write("USER", username, function (err, data) {
    if (err) {
      return cb(err);
    }
    self.setMultiline(false);
    self.write("PASS", password, function (err, data) {
      if (err) {
        return cb(err);
      }
      self.setState(2);
      cb(null, data);
    });
  });
};

// SASL AUTH implementation
// Currently supports SASL PLAIN and CRAM-MD5
POP3Client.prototype.auth = function (type, username, password, cb) {

  type = type.toUpperCase();
  var self = this;
  var types = {"PLAIN": 1, "CRAM-MD5": 1};
  var initialresp = "";

  if (self.getState() !== 1) {
    return cb(new Error("invalid-state"));
  }
  if ((type in types) === false) {
    return cb(new Error('Invalid auth type'));
  }

  function tlsok(cb) {
    if (type === "PLAIN") {

      initialresp = " " + new Buffer(username + "\u0000" + username + "\u0000" + password).toString("base64") + "=";
      
      self.write("AUTH", type + initialresp,function (err, data) {
        if (err) {
          return cb(err);
        }
        self.setState(2);
        cb(null,data);
      });

    } else if (type === "CRAM-MD5") {
      
      self.write("AUTH", type + initialresp, function (err, data) {

        if (err) {
          return cb(new Error('Server responded -ERR to AUTH CRAM-MD5'));          
        }

        var challenge = new Buffer(data.trim().substr(2), "base64").toString();
        var hmac = crypto.createHmac("md5", password);
        var response = new Buffer(username + " " + hmac.update(challenge).digest("hex")).toString("base64");

        self.write(response,null,function (err, data) {
          if (err) {
            return cb(err);
          }
          self.setState(2);
          cb(null,data);
        });

      });
    }

  }

  if (self.data["tls"] === false && self.data["stls"] === false) {
    self.stls(function (err, rawdata) {
      if (err) {
        // We (optionally) ignore self signed cert errors,
        // in blatant violation of RFC 2595, Section 2.4
        if (self.data["ignoretlserrs"] === true) {
          if (self.debug) {
            console.log('Ignoring TLS Error:', err);
          }
          return tlsok(cb);
        }
        return cb(new Error('Unable to upgrade connection to STLS ' + rawdata));
      }
      tlsok(cb);
    });
  } else {
    tlsok(cb);
  }
};

POP3Client.prototype.apop = function (username, password, cb) {
  var self = this;
  if (self.getState() !== 1) {
    return cb(new Error("invalid-state"));
  }
  if (self.data["apop"] === false) {
    return cb(new Error("APOP support not detected on remote server"));
  }
  self.setMultiline(false);
  self.write("APOP", username + " " + crypto.createHash("md5").update(self.data["apop-timestamp"] + password).digest("hex"), function (err, data) {
    if (err) {
      return cb(err);
    }
    self.setState(2);
    cb(null, data);
  });
};

POP3Client.prototype.stls = function (cb) {

  var self = this;

  if (self.getState() !== 1) {
    return cb(new Error("invalid-state"));
  }
  if (self.data["tls"] === true) {
    return cb(new Error("Unable to execute STLS as TLS connection already established"));
  }
  self.setMultiline(false);
  self.write("STLS", null, function (err, data) {
    if (err) {
      return cb(err);
    }
    self.starttls(function (err, data) {
      if (self.data["ignoretlserrs"] === true) {
        if (self.debug) {
          console.log('Ignoring TLS Error:', err);
        }
        err = null;
      }
      if (err) {
        return cb(err);
      }
      self.data["stls"] = true;
      cb(null,data);
    });
  });

};


POP3Client.prototype.top = function (msgnumber, lines, cb) {
  var self = this;
  if (self.getState() !== 2) {
    return cb(new Error("invalid-state"));
  }

  self.setMultiline(true);
  self.write("TOP", msgnumber + " " + lines, function (err, data) {
    if (err) {
      return cb(err);
    }
    
    var returnValue = "";
    var startOffset = data.indexOf("\r\n", 0) + 2;
    var endOffset = data.indexOf("\r\n.\r\n", 0) + 2;

    if (endOffset > startOffset) {
      returnValue = data.substr(startOffset, endOffset - startOffset);
    }
    cb(null, returnValue);
  });
};

POP3Client.prototype.list = function (msgnumber, cb) {
  var self = this;
  if (self.getState() !== 2) {
    return cb(new Error("invalid-state"));
  }

  if (msgnumber) {
    self.setMultiline(false);
  } else {
    self.setMultiline(true);
  }

  self.write("LIST", msgnumber, function (err, data) {
    if (err) {
      return cb(err);
    }
    var returnValue = null;
    var msgcount = 0;
    returnValue = [];
    if (msgnumber) {
      msgcount = 1;
      listitem = data.split(" ");
      returnValue[listitem[1]] = listitem[2];

    } else {

      var offset = 0;
      var listitem = "";
      var newoffset = 0;
      var returnValue = {};
      var startOffset = data.indexOf("\r\n", 0) + 2;
      var endOffset = data.indexOf("\r\n.\r\n", 0) + 2;

      if (endOffset > startOffset) {

        data = data.substr(startOffset, endOffset - startOffset);

        while (true) {

          if (offset > endOffset) {
            break;
          }

          newoffset = data.indexOf("\r\n", offset);

          if (newoffset < 0) {
            break;
          }

          msgcount++;
          listitem = data.substr(offset, newoffset - offset);
          listitem = listitem.split(" ");
          returnValue[listitem[0]] = listitem[1];
          offset = newoffset + 2;

        }
      }
    }
    cb(null, returnValue);
  });
};

POP3Client.prototype.stat = function (cb) {
  var self = this;
  if (self.getState() !== 2) {
    return cb(new Error("invalid-state"));
  }
  self.setMultiline(false);
  self.write("STAT", null, function (err, data) {
    if (err) {
      return cb(err);
    }

    var listitem = data.split(" ");
    var returnValue = {
      "count": listitem[1].trim(),
      "octets": listitem[2].trim()
    };
    cb(null, returnValue);
  });
};

POP3Client.prototype.uidl = function (msgnumber, cb) {
  var self = this;

  if (self.getState() !== 2) {
    return cb(new Error("invalid-state"));
  }
  
  if (msgnumber) {
    self.setMultiline(false);
  } else {
    self.setMultiline(true);
  }

  self.write("UIDL", msgnumber, function (err, data) {
    if (err) {
      return cb(err);
    }
    var returnValue = [];

    if (msgnumber !== undefined) {

      listitem = data.split(" ");
      returnValue[listitem[1]] = listitem[2].trim();

    } else {

      var offset = 0;
      var listitem = "";
      var newoffset = 0;
      var returnValue = [];
      var startOffset = data.indexOf("\r\n", 0) + 2;
      var endOffset = data.indexOf("\r\n.\r\n", 0) + 2;

      if (endOffset > startOffset) {

        data = data.substr(startOffset, endOffset - startOffset);
        endOffset -= startOffset;

        while (offset < endOffset) {

          newoffset = data.indexOf("\r\n", offset);
          listitem = data.substr(offset, newoffset - offset);
          listitem = listitem.split(" ");
          returnValue[listitem[0]] = listitem[1];
          offset = newoffset + 2;

        }
      }
    }
  });
};

POP3Client.prototype.retr = function (msgnumber, cb) {
  var self = this;
  if (self.getState() !== 2) {
    return cb(new Error("invalid-state"));
  }
  self.setMultiline(true);
  self.write("RETR", msgnumber, function (err, data) {
    if (err) {
      return cb(err);
    }
    var startOffset = data.indexOf("\r\n", 0) + 2;
    var endOffset = data.indexOf("\r\n.\r\n", 0);
    var returnValue = data.substr(startOffset, endOffset - startOffset);
    cb(null, returnValue);
  });
};

POP3Client.prototype.dele = function (msgnumber, cb) {
  var self = this;
  if (self.getState() !== 2) {
    return cb(new Error("invalid-state"));
  }
  self.setMultiline(false);
  self.write("DELE", msgnumber, function (err, data) {
    if (err) {
      cb(err);
    }
    cb(null, msgnumber);
  });
};

POP3Client.prototype.noop = function (cb) {
  var self = this;
  if (self.getState() !== 2) {
    return cb(new Error("invalid-state"));
  }
  self.setMultiline(false);
  self.write("NOOP", null, function (err, data) {
    if (err) {
      return cb(err);
    }
    cb(null,data);
  });

};

POP3Client.prototype.rset = function (cb) {
  var self = this;
  if (self.getState() !== 2) {
    return cb(new Error("invalid-state"));
  }
  self.setMultiline(false);
  self.write("RSET", null, function (err, data) {
    if (err) {
      return cb(err);
    }
    cb(null, data);
  });
};

POP3Client.prototype.capa = function (cb) {
  if (self.getState() === 0) {
    return cb(new Error("invalid-state"));
  }
  var self = this;
  self.setMultiline(true);
  self.write("CAPA", null, function (err, data) {
    if (err) {
      return cb(err);
    }
    var startOffset = data.indexOf("\r\n", 0) + 2;
    var endOffset = data.indexOf("\r\n.\r\n", 0);
    var returnValue = data.substr(startOffset, endOffset - startOffset);
    returnValue = returnValue.split("\r\n");
    cb(null, data);
  });
};

POP3Client.prototype.quit = function (cb) {
  var self = this;
  var cb = cb || function() {};
  if (self.getState() === 0) {
    return cb(new Error("invalid-state"));
  }
  self.setMultiline(false);
  self.write("QUIT", null, function (err, data) {
    if (err) {
      return cb(err);
    }
    self.end();
    cb(null, data);
  });
};

module.exports = POP3Client;