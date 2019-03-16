const
  log = require('loglevel').getLogger('openhab'),
  request = require('request'),
  HttpStatus = require('http-status-codes');
utils = require('./utils'),
  format = utils.format;

class OpenHab {
  constructor(config, sitemap) {
    this.config = config;
    this.sitemap = sitemap;
    this.openHabRestUri = this.config.openHabRestUri;
  }

  executeRequest({
    itemNode,
    value
  }) {
    return new Promise((resolve, reject) => {
      if (value === undefined) {
        this.getItemValue(itemNode, resolve, reject);
      } else if (typeof itemNode == 'object') {
        let commandValue = this.findCommandValue(value, itemNode.values, itemNode.mappings);
        if (commandValue) {
          this.sendItemCommand(itemNode.command, commandValue.toUpperCase(), resolve, reject);
        } else {
          reject(format('Unsupported command value %s', value));
        }
      } else {
        this.setItemValue(itemNode, value, resolve, reject);
      }
    });
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

  sendItemCommand(item, value, resolve, reject) {
    log.debug('Sending OpenHab item %s command %s', item, value);
    let httpOptions = {
      uri: format('%s/items/%s', this.openHabRestUri, item),
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain',
        'Accept': 'application/json;charset=UTF-8',
        'Accept-Charset': 'UTF-8'
      },
      body: value.toString()
    };
    request(httpOptions, (err, res, body) => {
      let errorResult = err || (res.statusCode != HttpStatus.ACCEPTED ? body : null);
      if (errorResult) {
        reject(errorResult);
      } else {
        resolve({
          item,
          value,
          updated: true,
          req: httpOptions,
          res: res
        });
      }
    });
  }

  getItem(item, resolve, reject) {
    log.debug('Getting OpenHab item %s', item);
    let httpOptions = {
      uri: format('%s/items/%s', this.openHabRestUri, item),
      method: 'GET',
      headers: {
        'Accept': 'application/json;charset=UTF-8',
        'Accept-Charset': 'UTF-8'
      }
    };
    request(httpOptions, (err, res, body) => {
      let errorResult = err || (res.statusCode != HttpStatus.OK ? body : null);
      if (errorResult) {
        reject(errorResult);
      } else {
        resolve({
          item,
          value: JSON.parse(body),
          updated: false,
          req: httpOptions,
          res: res
        });
      }
    });
  }

  getItemValue(item, resolve, reject) {
    log.debug('Getting OpenHab item %s value', item);
    let httpOptions = {
      uri: format('%s/items/%s/state', this.openHabRestUri, item),
      method: 'GET',
      headers: {
        'Accept': 'text/plain;charset=UTF-8',
        'Accept-Charset': 'UTF-8'
      }
    };
    request(httpOptions, (err, res, body) => {
      let errorResult = err || (res.statusCode != HttpStatus.OK ? body : null);
      if (errorResult) {
        reject(errorResult);
      } else {
        resolve({
          item,
          value: body,
          updated: false,
          req: httpOptions,
          res: res
        });
      }
    });
  }

  setItemValue(item, value, resolve, reject) {
    log.debug('Setting OpenHab item %s value %s', item, value);
    let httpOptions = {
      uri: format('%s/items/%s/state', this.openHabRestUri, item),
      method: 'PUT',
      headers: {
        'Content-Type': 'text/plain',
        'Accept': 'application/json;charset=UTF-8',
        'Accept-Charset': 'UTF-8'
      },
      body: value.toString()
    };
    request(httpOptions, (err, res, body) => {
      let errorResult = err || (res.statusCode != HttpStatus.OK ? body : null);
      if (errorResult) {
        reject(errorResult);
      } else {
        resolve({
          item,
          value,
          updated: true,
          req: httpOptions,
          res: res
        });
      }
    });
  }
}

module.exports = OpenHab;