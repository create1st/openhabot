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
  OPENHAB_OPERATIONS = 'openhab_operations',
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
    let confidentEntities = this.getConfidentEntities(entities);
    let possibleOptions = this.findPossibleOptions(this.sitemap, confidentEntities, []);
    let request = this.getExactMatch(possibleOptions);
    if (request) {
      this.executeApiCall(request, callback);
    } else {
      this.requestMoreIntents(possibleOptions, callback);
    }
  }

  executeApiCall(request, callback) {
    let itemNode = request.itemNode;
      let value = request.value;
      if (value === undefined) {
        this.getItemValue(itemNode, callback);
      } else if (request.value == null) {
        this.requestValue(request, callback);
      } else if (typeof itemNode == 'object') {
        let commandValue = this.findCommandValue(value, itemNode.values, itemNode.mappings);
        if (commandValue) {
          this.sendItemCommand(itemNode.command, commandValue.toUpperCase(), callback);          
        } else {
          this.requestValue(request, callback);
        }
      } else {
        this.setItemValue(itemNode, value, callback);
      }
  }

  getConfidentEntities(entities) {
    let result = {};
    for (const [entityName, entity] of Object.entries(entities)) {
      if (entityName != OPENHAB_UNIT) {
        let confidentEntityEntry = entityName == OPENHAB_VALUE ? this.getConfidentValueEntityEntry(entity) : this.getConfidentEntityEntry(entity);
        if (confidentEntityEntry != null) {
          result[entityName] = confidentEntityEntry;
        }        
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
      if (nodeName == OPENHAB_DEFAULT_ITEM) {
        let possibleOption = this.checkPossibleOption(entities, parentCandidates, node)
        if (possibleOption) {
          possibleOptions.push(possibleOption);
        }
      } else if (nodeName == OPENHAB_STATE) {
        let candidates = this.getCandidates(parentCandidates, nodeName, null);
        let possibleOption = this.checkPossibleOption(entities, candidates, node)
        if (possibleOption) {
          possibleOptions.push(possibleOption);
        }
      } else {
        for (const [valueNodeName, valueNode] of Object.entries(node)) {
          let candidates = this.getCandidates(parentCandidates, nodeName, valueNodeName);
          if (typeof valueNode == 'object') {
            this.findPossibleOptions(valueNode, entities, candidates).forEach((e) => possibleOptions.push(e));
          } else {
            let finalCandidates = valueNodeName == OPENHAB_SET ? this.getCandidates(candidates, OPENHAB_VALUE, null) : candidates;
            let possibleOption = this.checkPossibleOption(entities, finalCandidates, valueNode)
            if (possibleOption) {
              possibleOptions.push(possibleOption);
            }
          }
        }    
      }
    }
    return possibleOptions;
  }

  getCandidates(parentCandidates, entity, value) {
    let candidate = {entity: entity, value: value};
    let candidates = parentCandidates.slice(0);
    candidates.push(candidate);
    return candidates;
  }

  checkPossibleOption(entities, candidates, itemNode) {
    let missingNodes = [];
    var matched = 0;
    var value = undefined;
    candidates.forEach((candidate) => {
      let candidateEntity = candidate.entity;
      let candidateValue = candidate.value;
      let entity = entities[candidateEntity];
      if (candidateEntity == OPENHAB_VALUE || candidateEntity == OPENHAB_STATE) {
        if (entity) {
          value = entity.value;
          matched++;
        } else {
          value = null;
        }
      } else {
        if (entity) {
          if (entity.value != candidate.value) return null;
          matched++;
        } else {
          missingNodes.push(candidate);
        }        
      }
    });
    if (Object.keys(entities).length > matched) return null;
    return {itemNode: itemNode, missingNodes: missingNodes, value: value};
  }

  getExactMatch(possibleOptions) {
    for (let possibleOption of possibleOptions) {
      if (possibleOption.missingNodes.length == 0) return possibleOption;
    }
    return null;
  }

  requestMoreIntents(possibleOptions, callback) {
    callback({item: null, value: null, updated: false, err: null, res: possibleOptions});
  }

  requestValue(request, callback) {
    let itemNode = request.itemNode;
    let item = typeof itemNode == 'object' ? itemNode.command : itemNode;
    callback({item: item, value: undefined, updated: false, err: null, res: request});
  }

  findCommandValue(value, possibleValues, mappings) {
    if (possibleValues) {
      for (let possibleValue of possibleValues) {
        if (possibleValue == value) {
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
  }
}

module.exports = OpenHab;