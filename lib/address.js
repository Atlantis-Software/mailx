var Address = function(name,address) {
  this.name = name || '';
  this.address = address || '';
};

Address.prototype.toString = function() {
  var str = '';
  if (this.name) {
    str += this.name + ' ';
  }
  str += '<' + this.address + '>';
  return str;
};

module.exports = Address;