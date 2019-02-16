const 
  request = require('request'),
  HttpStatus = require('http-status-codes');

class OpenHab {
  constructor(config, sitemap) {
    this.openHabRest = config.openHabRest;
    this.sitemap = sitemap;
  }

  execute(entities, callback) {
    console.log("Checking entities: %o", entities)
    let item = this.find(entities, this.sitemap, callback);
    if (!item) {
      callback({item: null, value: null, updated: false, err: null, res: null});
    }
  }

  find(entities, parent, callback) {
    let self=this;
    for (const [nodeName, node] of Object.entries(parent)) {
      if (entities[nodeName] && entities[nodeName][0].confidence > 0.77) {
        console.log("found: %s", nodeName)
        if (nodeName == "openhab_set" && entities.number) {
          return self.setItemValue(node, entities.number[0].value, callback);
        } else if (nodeName == "openhab_get") {
          return self.getItemValue(node, callback);
        }
        return self.find(entities, node, callback);
      }
    };
    console.log("Not found");
    return null;
  }

  getItemValue(item, callback) {
    console.log("Getting OpenHab item %s value", item);
    let httpOptions = {
      uri: this.openHabRest +"/items/" + item + "/state",
      method: "GET",
      headers: {"Accept": "text/plain"}
    };
    request(httpOptions, (err, res, body) => {
      callback({item: item,body: body, updated:false, err: err || (res.statusCode != HttpStatus.OK ? body : null), res: res});
    });
    return item;
  }

  setItemValue(item, value, callback) {
    console.log("Setting OpenHab item %s value %s", item, value);
    let httpOptions = {
      uri: this.openHabRest + "/items/" + item + "/state",
      method: "PUT",
      headers: {
        "Content-Type": "text/plain",
        "Accept": "application/json"
      },
      body: value.toString()
    };
    request(httpOptions, (err, res, body) => {
      callback({item: item, value: value, updated: (err == null), err: err || (res.statusCode != HttpStatus.ACCEPTED ? body : null), res: res});
    });
    return item;
  }
}

module.exports = OpenHab;