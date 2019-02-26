const
  request = require('request'),
  HttpStatus = require('http-status-codes');
  utils = require('./utils'),
  format = utils.format;

const
  OPENHAB_SET = 'openhab_set',
  OPENHAB_GET = 'openhab_get',
  OPENHAB_COMMMAND = 'openhab_command';


class OpenHab {
  constructor(config, sitemap) {
    this.openHabRestUri = config.openHabRestUri;
    this.confidenceLevel = parseFloat(config.confidenceLevel);
    this.sitemap = sitemap;
  }

  execute(entities, callback) {
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
            if (nodeName == OPENHAB_SET) {
              let value = this.findValue(entities);
              if (value) {
                return this.setItemValue(node, value, callback);
              }
              console.error('Value not found');
              return null;
            } else if (nodeName == OPENHAB_GET) {
              return this.getItemValue(node, callback);
            }
            return this.find(node, entities, callback);
          }
        }
      } else if (nodeName == OPENHAB_COMMMAND)  {
        console.log('found command');
        let commandValue = this.findCommandValue(parent.values, entities, parent.mappings)
        if (commandValue) {
          return this.sendItemCommand(node, commandValue.toUpperCase(), callback);          
        } 
        console.error('Invalid value');
        return null;
      }
    };
    console.error('Not found');
    return null;
  }

  findValue(entities) {
    let valueEntity = entities.number;
    if (valueEntity && valueEntity.length == 1) {
      return valueEntity[0].value;
    }
    return null;
  }

  findCommandValue(values, entities, mappings) {
    if (values) {
      for (let value of values) {
        let valueEntity = entities[value];
        if (valueEntity && valueEntity.length == 1 && valueEntity[0].confidence > this.confidenceLevel) {
          return this.getCommandValue(value, mappings);
        }
      }      
    }
    return null;
  }

  getCommandValue(commandValue, mappings) {
    let mappedCommandValue = mappings ? mappings[commandValue] : null;
    return mappedCommandValue ? mappedCommandValue : commandValue;
  }

  sendItemCommand(item, value, callback) {
    console.log('Sending OpenHab item %s command %s', item, value);
    let httpOptions = {
      uri: format('%s/items/%s', this.openHabRestUri, item),
      method: 'POST',
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