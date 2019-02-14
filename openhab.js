const 
  request = require('request'),
  HttpStatus = require('http-status-codes');

class OpenHab {
  constructor(config, sitemap) {
    this.openHabRest = config.openHabRest;
    this.sitemap = sitemap;
  }

  execute(entities, callback) {
    console.log("Processing entities:" + JSON.stringify(entities, null, 4));
    let item = "zwave_device_bca80c4e_node2_thermostat_setpoint_heating";
    //this.getItemValue(item, callback)
    this.setItemValue(item, "22", callback)
  }

  getItemValue(item, callback) {
    console.log('Getting OpenHab item value ' + item);
    let httpOptions = {
      "uri": this.openHabRest +"/items/" + item + "/state",
      "method": "GET",
      "headers": {"Accept": "text/plain"}
    };
    request(httpOptions, (err, res, body) => {
      callback({
        "item": item,
        "value": body, 
        "updated": false,
        "err": err || (res.statusCode != HttpStatus.OK ? body : null),
        "res": res});
    });
  }

  setItemValue(item, value, callback) {
    console.log('Setting OpenHab item value ' + item);
    let httpOptions = {
      "uri": this.openHabRest + "/items/" + item + "/state",
      "method": "PUT",
      "headers": {
        "Content-Type": "text/plain",
        "Accept": "application/json"
      },
      "body": value
    };
    request(httpOptions, (err, res, body) => {
      callback({
        "item": item,
        "value": value,
        "updated": (err == null),
        "err": err || (res.statusCode != HttpStatus.ACCEPTED ? body : null),
        "res": res});
    });
  }
}

module.exports = OpenHab;