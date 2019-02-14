const 
  request = require('request'),
  HttpStatus = require('http-status-codes');

class OpenHab {
  setItemValue(item, value, callback) {
    console.log('Setting OpenHap item value ' + item);
    request({
      "uri": "http://127.0.0.1:8080/rest/items/" + item + "/state",
      "method": "PUT",
      "headers": {
        "Content-Type": "text/plain",
        "Accept": "application/json"
      },
      "body": value
    }, (err, res, body) => {
      if (err) {
        console.log('Request to OpenHab failed:' + JSON.stringify(res, null, 4));
        callback.errorMessage = err;
      } else if (res.statusCode != HttpStatus.ACCEPTED) {
        console.log('Request rejected by OpenHab:' + JSON.stringify(res, null, 4));
        callback.errorMessage = callback.errorMessage;
      } else {
        console.log('Request to OpenHab completed');
        callback.data = body;
      }
    }); 
  }
}

module.exports = OpenHab;