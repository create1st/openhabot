const
  request = require('request'),
  HttpStatus = require('http-status-codes');
  utils = require('./utils'),
  format = utils.format;

const
  OPENHAB_VALUE = 'number',
  OPENHAB_UNIT = 'openhab_unit',
  OPENHAB_SET = 'set',
  OPENHAB_GET = 'get',
  OPENHAB_DATA_ITEM = 'openhab_data_item'
  OPENHAB_DEFAULT_ITEM = 'default',
  OPENHAB_STATE = 'openhab_state',
  OPENHAB_COMMMAND = 'command',
  OPENHAB_POSTBACK_REQUEST = 'posback_request';


class OpenHab {
  constructor(config, sitemap) {
    this.config = config;
    this.sitemap = sitemap;
    this.initialize();
  }

  initialize() {
    this.openHabRestUri = this.config.openHabRestUri;
    this.confidenceLevel = parseFloat(this.config.confidenceLevel);
  }

  reloadConfigs() {
    this.config.reload();
    this.sitemap.reload();
    this.initialize();
  }

  execute(entities, callback) {
    //let item = this.find(this.sitemap, entities, callback);
    // if (!item) {
    //   callback({item: null, value: null, updated: false, err: null, res: null});
    // }
    let confidentEntities = this.getConfidentEntities(entities);
    console.log("confident entities %o", confidentEntities);
    let possibleOptions = this.findPossibleOptions(this.sitemap, confidentEntities, []);
    console.log("Result: %o", possibleOptions);
    let exactMatch = this.getExactMatch(possibleOptions);
    console.log("Exact match: %o", exactMatch);
    // filter missingNodes: [ [length]: 0 
  }

  getConfidentEntities(entities) {
    let result = {};
    for (const [entityName, entity] of Object.entries(entities)) {
      let confidentEntityEntry = entityName == OPENHAB_VALUE ? this.getConfidentValueEntityEntry(entity) : this.getConfidentEntityEntry(entity);
      if (confidentEntityEntry != null) {
        result[entityName] = confidentEntityEntry;
      }
    }
    return result;
  }

  getConfidentValueEntityEntry(entity) {
    if (entity.length == 1 && entity[0].confidence > this.confidenceLevel) {
      return entity[0];
    }
    return null;
  }

  getConfidentEntityEntry(entity) {
    for (let entityEntry of entity) {
      if (entityEntry.confidence > this.confidenceLevel) {
        return entityEntry;
      }
    }
    return null;
  }

  findPossibleOptions(parent, entities, parentCandidates) {
    let possibleOptions = [];
    for (const [nodeName, node] of Object.entries(parent)) {
      if (nodeName == OPENHAB_DEFAULT_ITEM || nodeName == OPENHAB_STATE) {
        let possibleOption = this.checkPossibleOption(entities, parentCandidates, node)
        if (possibleOption) {
          possibleOptions.push(possibleOption);
        }
      } else {
        for (const [valueNodeName, valueNode] of Object.entries(node)) {
          let candidate = {entity: nodeName, value: valueNodeName};
          let candidates = parentCandidates.slice(0);
          candidates.push(candidate);
          if (typeof valueNode == 'object') {
            this.findPossibleOptions(valueNode, entities, candidates).forEach((e) => possibleOptions.push(e));
          } else {
            let possibleOption = this.checkPossibleOption(entities, candidates, valueNode)
            if (possibleOption) {
              possibleOptions.push(possibleOption);
            }
          }
        }    
      }
    }
    return possibleOptions;
  }

  checkPossibleOption(entities, candidates, itemNode) {
    let entityValue = entities[OPENHAB_VALUE];
    let entityState = entities[OPENHAB_STATE];
    let state = entityState && entityState.value
    let value = entityValue && entityValue.value;
    let missingNodes = [];
    var matched = value || state ? 1 : 0;
    if (entities[OPENHAB_UNIT]) matched++;
    candidates.forEach((candidate) => {
      let entity = entities[candidate.entity];
      if (entity) {
        if (entity.value != candidate.value) return null;
        matched++;
      } else {
        missingNodes.push(candidate)
      }
    });
    if (Object.keys(entities).length > matched) return null;
    return {itemNode: itemNode, missingNodes: missingNodes, value: value ? value : state};
  }

  getExactMatch(possibleOptions) {
    for (let possibleOption of possibleOptions) {
      if (possibleOption.missingNodes.length == 0) return possibleOption;
    }
    return null;
  }

  find(parent, entities, callback) {
    for (const [nodeName, node] of Object.entries(parent)) {
      let entity = entities[nodeName];
      if (entity) {
        for (let entityEntry of entity) {
          if (entityEntry.confidence > this.confidenceLevel) {
            let entityEntryValue = entityEntry.value;
            console.log('found: %s, %s', nodeName, entityEntryValue);
            let valueNode = node[entityEntryValue];
            if (valueNode == null) {
              console.error('Item not found');
              return null;
            } else if (entityEntryValue == OPENHAB_SET) {
              let value = this.findValue(entities);
              if (value) {
                return this.setItemValue(valueNode, value, callback);
              }
              console.error('Value not found');
              return null;
            } else if (entityEntryValue == OPENHAB_GET) {
              if (typeof valueNode == 'object') {
                let dataItem = this.findDataItem(entities, valueNode);
                if (dataItem) {
                  return this.getItemValue(dataItem, callback);                  
                }
                console.error('No data item found')
                return null;
              }
              return this.getItemValue(valueNode, callback);
            }
            return this.find(valueNode, entities, callback);
          }
        }
      } else if (nodeName == OPENHAB_COMMMAND)  {
        console.log('found command');
        let commandValue = this.findCommandValue(parent.values, entities, parent.mappings) //entities['openhab_state']
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

  requestMoreIntents() {
    callback({item: null, value: null, updated: false, err: null, res: null});
    return ;
  }

  findDataItem(entities, valueNode) {
    let dataItemEntity = entities[OPENHAB_DATA_ITEM];
    if (dataItemEntity == null) {
      return valueNode[OPENHAB_DEFAULT_ITEM];
    } else if (dataItemEntity && dataItemEntity.length == 1) {
      let dataItem = dataItemEntity[0].value;
      return valueNode[OPENHAB_DATA_ITEM][dataItem];
    }
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
    let stateEntity = entities[OPENHAB_STATE];
    if (values && stateEntity && stateEntity.length == 1 && stateEntity[0].confidence > this.confidenceLevel) {
      let stateEntityValue = stateEntity[0].value;
      for (let value of values) {
        if (stateEntityValue == value) {
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