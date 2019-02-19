const
  request = require('request'),
  HttpStatus = require('http-status-codes');
  utils = require('./utils'),
  format = utils.format;

class OpenHab {
  constructor(config, sitemap) {
    this.openHabRestUri = config.openHabRestUri;
    this.confidenceLevel = parseFloat(config.confidenceLevel);
    this.sitemap = sitemap;
  }

  execute(entities, callback) {
    console.log('Checking entities: %o', entities)
    let item = this.find(this.sitemap, entities, callback);
    if (!item) {
      callback({item: null, value: null, updated: false, err: null, res: null});
    }
  }

  find(parent, entities, callback) {
    for (const [nodeName, node] of Object.entries(parent)) {
      let entity = entities[nodeName];
      if (entity) {
        for (let rule of entity) {
          if (rule.confidence > this.confidenceLevel) {
            console.log('found: %s', nodeName)
            if (nodeName == 'openhab_set') {
              let valueEntity = entities.number;
              if (valueEntity && valueEntity.length == 1) {
                let value = entities.number[0].value;
                return this.setItemValue(node, value, callback);
              }
            } else if (nodeName == 'openhab_get') {
              return this.getItemValue(node, callback);
            }
            return this.find(node, entities, callback);
          }
        }
      }
    };
    console.log('Not found');
    return null;
  }

  getItem(item, callback) {
    console.log('Getting OpenHab item %s', item);
    let httpOptions = {
      uri: format('%s/items/%s', this.openHabRestUri, item),
      method: 'GET',
      headers: {'Accept': 'application/json'}
    };
    request(httpOptions, (err, res, body) => {
      callback({item: item, value: JSON.parse(body), updated: false, err: err || (res.statusCode != HttpStatus.OK ? body : null), res: res});
    });
    return item;
  }

  getItemValue(item, callback) {
    console.log('Getting OpenHab item %s value', item);
    let httpOptions = {
      uri: format('%s/items/%s/state', this.openHabRestUri, item),
      method: 'GET',
      headers: {'Accept': 'text/plain'}
    };
    request(httpOptions, (err, res, body) => {
      callback({item: item, value: body, updated: false, err: err || (res.statusCode != HttpStatus.OK ? body : null), res: res});
    });
    return item;
  }

  setItemValue(item, value, callback) {
    console.log('Setting OpenHab item %s value %s', item, value);
    let httpOptions = {
      uri: format('%s/items/%s/state', this.openHabRestUri, item),
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        'Accept': 'application/json'
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