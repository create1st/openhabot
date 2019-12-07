const
  log = require('loglevel').getLogger('bot'),
  express = require('express'),
  bodyParser = require('body-parser'),
  request = require('request'),
  HttpStatus = require('http-status-codes'),
  utils = require('./utils'),
  getProperty = require('lodash/get'),
  format = utils.format,
  sliceArray = utils.sliceArray,
  toWav = require('audiobuffer-to-wav'),
  AudioContext = require('web-audio-api').AudioContext,
  audioContext = new AudioContext();

const
  OPENHAB_DATA_ITEM = 'openhab_data_item',
  OPENHAB_OPERATIONS = 'openhab_operations',
  IMAGE_GET_INTENTS_URI = 'https://www.iconfinder.com/icons/17821/download/png/128',
  GRAPH_BUTTONS_PER_PAGE_LIMIT = 3,
  GRAPH_ELEMENTS_LIMIT = 10,
  GRAPH_BUTTON_ELEMENTS_LIMIT = GRAPH_BUTTONS_PER_PAGE_LIMIT * GRAPH_ELEMENTS_LIMIT,
  IMAGE_BASE64 = new RegExp('^data:(image\/(.*));base64,(.*)$'),
  RESPONSE_EVENT_RECEIVED = 'EVENT_RECEIVED',
  RESPONSE_UPDATED = 'UPDATED',
  RESPONSE_RESTARTING = 'RESTARTING',
  UPDATE_STATE_MESSAGE_MAPPING = 'update_state_message_mapping',
  MESSAGE_BOT_STARTED = 'message.bot_started',
  MESSAGE_CONFIG_REFRESH = 'message.config_refresh',
  MESSAGE_UPDATE = 'message.update',
  MESSAGE_UNRECOGNIZED_COMMAND = 'message.unrecognized_command',
  MESSAGE_GET_VALUE = 'message.get_value',
  MESSAGE_GET_VALUE_UNDEFINED = 'message.get_value_undefined',
  MESSAGE_SELECT_OPTION = 'message.select_option',
  MESSAGE_MISSING_VALUE = 'message.missing_value',
  ERROR_OPENHAB_CALL_FAILED = 'error.openhab_call_failed',
  ERROR_WIT_CALL_FAILED = 'error.wit_call_failed',
  ERROR_UNSUPPORTED_MESSAGE_TYPE = 'error.unsupported_message_type',
  ERROR_UNAUTHORIZED = 'error.unauthorized';

class Bot {
  constructor(config, dictionary, fbMe, wit, openHab, lookup) {
    this.config = config;
    this.fbMe = fbMe;
    this.openHab = openHab;
    this.dictionary = dictionary;
    this.wit = wit;
    this.lookup = lookup;
    this.webhookApp = express().use(bodyParser.json());
    this.httpBindingApp = express().use(bodyParser.json());
    this.lastResponse = {};
  }

  start() {
    this.startWebHookApp();
    this.startHttpBindingApp();
    this.notifyAll(MESSAGE_BOT_STARTED);
  }

  startWebHookApp() {
    let self = this;
    this.webhookApp.listen(this.config.webhookPort, () => log.info('webhook is listening on port %s', this.config.webhookPort));
    this.webhookApp.get('/webhook', (req, res) => {
      let mode = req.query['hub.mode'];
      let token = req.query['hub.verify_token'];
      let challenge = req.query['hub.challenge'];
      if (mode && token) {
        if (mode === 'subscribe' && token === this.config.verifyToken) {
          log.info('Webhook authorized by Facebook application');
          res.status(HttpStatus.OK).send(challenge);
        } else {
          res.sendStatus(HttpStatus.FORBIDDEN);
        }
      }
    });
    this.webhookApp.post('/webhook', (req, res) => {
      let body = req.body;
      if (body.object === 'page') {
        body.entry.forEach((entry) => {
          entry.messaging.forEach(event => {
            if ((event.message && !event.message.is_echo) || event.postback) {
              self.handleWebhookEvent(event)
            }
          });
        });
        res.status(HttpStatus.OK).send(RESPONSE_EVENT_RECEIVED);
      } else {
        res.sendStatus(HttpStatus.NOT_FOUND);
      }
    });
  }

  startHttpBindingApp() {
    this.httpBindingApp.listen(this.config.openHabHttpBindingPort, () => log.info('openHab HttpBinding is listening on port %s', this.config.openHabHttpBindingPort));
    this.httpBindingApp.post('/rest/items/:item/state', (req, res) => {
      res.status(HttpStatus.OK).send(RESPONSE_EVENT_RECEIVED);
      let updatedItem = req.params.item;
      let state = req.query.state;
      if (state && state.match(IMAGE_BASE64)) {
        this.notifyAllWithImageBase64(state);
      } else {
        this.openHab.getItem(updatedItem, ({
          item,
          value,
          updated,
          err,
          res
        }) => {
          let itemName = err ? updatedItem : value.label;
          let message = this.getUpdateStateMessage(state);
          let i18nState = this.getStateText(state)
          this.notifyAll(message, itemName, i18nState);
        });
      }
    });
    this.httpBindingApp.post('/rest/system/config/reload', (req, res) => {
      log.debug('Refreshing configuration');
      this.config.reload();
      this.dictionary.reload();
      this.lookup.reloadConfigs();
      res.status(HttpStatus.OK).send(RESPONSE_UPDATED);
      this.notifyAll(MESSAGE_CONFIG_REFRESH);
    });
    this.httpBindingApp.post('/rest/system/restart', (req, res) => {
      log.debug('Restarting OpenHaBot server');
      res.status(HttpStatus.OK).send(RESPONSE_RESTARTING);
      process.exit();
    });
  }

  handleWebhookEvent({
    sender,
    message,
    postback
  }) {
    let senderPsid = sender ? sender.id : null;
    if (this.config.authorizedSenders.length > 0 && !this.config.authorizedSenders.includes(senderPsid)) {
      this.handleUnauthorized(senderPsid);
    } else if (message) {
      this.handleMessage(senderPsid, message);
    } else if (postback) {
      this.handlePostback(senderPsid, postback);
    }
  }

  handleUnauthorized(senderPsid) {
    this.sendMessage(senderPsid, ERROR_UNAUTHORIZED, senderPsid);
  }

  handleMessage(senderPsid, {
    text,
    attachments
  }) {
    this.fbMe.typingOn(senderPsid);
    var selection = this.lastResponse[senderPsid];
    if (selection) {
      this.processPendingSelection(senderPsid, text, selection);
    } else if (text) {
      this.processText(senderPsid, text);
    } else if (attachments && attachments.length == 1 && attachments[0].type == 'audio') {
      this.processAudioAttachement(senderPsid, attachments[0].payload.url);
    } else {
      log.debug('Unsupported attachement type: %s', JSON.stringify(attachments));
      this.sendMessage(senderPsid, ERROR_UNSUPPORTED_MESSAGE_TYPE);
    }
  }

  processPendingSelection(senderPsid, text, selection) {
    delete this.lastResponse[senderPsid];
    let value = parseFloat(text);
    if (isNaN(value)) {
      this.sendMessage(senderPsid, MESSAGE_UNRECOGNIZED_COMMAND);
    } else {
      selection.value = value;
      this.executeRequest(senderPsid, selection);
    }
  }

  processText(senderPsid, text) {
    let queryString = text.toString('utf8');
    this.wit.message(queryString)
      .then((messageResult) => this.lookup.witAiMessageResult(messageResult))
      .then((lookupResult) => this.processLookupResult(senderPsid, lookupResult))
      .catch((err) => {
        log.error('Wit.Ai error:', err.stack || err);
        this.sendMessage(senderPsid, ERROR_WIT_CALL_FAILED, err.stack || err);
      });
  }

  processAudioAttachement(senderPsid, url) {
    this.downloadAttachment(url)
      .then(this.decodeAudio)
      .then((wav) => this.wit.speech(wav))
      .then((messageResult) => this.lookup.witAiMessageResult(messageResult))
      .then((lookupResult) => this.processLookupResult(senderPsid, lookupResult))
      .catch((err) => {
        log.error('Wit.Ai audio handling error:', err);
        this.sendMessage(senderPsid, ERROR_UNSUPPORTED_MESSAGE_TYPE);
      });
  }

  processLookupResult(senderPsid, {
    queryString,
    selection,
    possibleOptions
  }) {
    if (selection) {
      if (selection.value === null) {
        this.requestValueSelection(senderPsid, selection);
      } else {
        this.executeRequest(senderPsid, selection);
      }
    } else {
      this.requestOptionSelection(senderPsid, queryString, possibleOptions);
    }
  }

  executeRequest(senderPsid, selection) {
    this.openHab.executeRequest(selection)
      .then((openHabResponse) => this.openHabResponseHandler(senderPsid, openHabResponse))
      .catch((err) => {
        log.error('OpenHab error:', err);
        this.sendMessage(senderPsid, ERROR_OPENHAB_CALL_FAILED, err);
      });
  }

  requestOptionSelection(senderPsid, queryString, possibleOptions) {
    if (possibleOptions.length == 0 || possibleOptions.length > GRAPH_BUTTON_ELEMENTS_LIMIT) {
      log.error('OpenHab sitemap lookup failed.');
      this.sendMessage(senderPsid, MESSAGE_UNRECOGNIZED_COMMAND);
    } else {
      log.trace('Select options: %o', possibleOptions);
      this.getEntityDictionary(possibleOptions)
        .then((dictionary) => {
          let title = this.getMessageText(MESSAGE_SELECT_OPTION);
          let elements = this.getButtonElements(title, queryString, possibleOptions, dictionary);
          this.fbMe.genericTemplate(senderPsid, elements);
        }).catch((err) => {
          log.error('Wit.Ai error:', err.stack || err);
          this.sendMessage(senderPsid, ERROR_WIT_CALL_FAILED, err.stack || err);
        });
    }
  }

  requestValueSelection(senderPsid, selection) {
    log.trace('Missing value: %o', selection);
    let itemNode = selection.itemNode;
    if (typeof itemNode == 'object') {
      log.debug('Item node %o', itemNode);
      this.sendMessage(senderPsid, MESSAGE_UNRECOGNIZED_COMMAND);
    } else {
      this.lastResponse[senderPsid] = selection;
      this.sendMessage(senderPsid, MESSAGE_MISSING_VALUE);
    }
  }

  handlePostback(senderPsid, postback) {
    this.fbMe.typingOn(senderPsid);
    delete this.lastResponse[senderPsid];
    let selection = this.getSelection(postback);
    if (selection.value === null) {
      this.requestValueSelection(senderPsid, selection);
    } else {
      this.executeRequest(senderPsid, selection);
    }
  }

  getSelection({
    payload
  }) {
    let userSelection = JSON.parse(payload);
    return {
      itemNode: userSelection.itemNode,
      value: 'value' in userSelection ? userSelection.value : undefined
    };
  }

  openHabResponseHandler(senderPsid, {
    item,
    value,
    updated
  }) {
    if (!updated) {
      log.trace('OpenHab get value completed');
      if (value == null || value == 'NULL') {
        this.sendMessage(senderPsid, MESSAGE_GET_VALUE_UNDEFINED);
      } else if (value.match(IMAGE_BASE64)) {
        this.sendImageBase64(senderPsid, value);
      } else {
        let i18nState = this.getStateText(value);
        this.sendMessage(senderPsid, MESSAGE_GET_VALUE, i18nState);
      }
    } else {
      log.trace('OpenHab set value completed');
      let state = value;
      this.openHab.getItem(item, ({
        value,
        err
      }) => {
        let itemName = err ? item : value.label;
        let message = this.getUpdateStateMessage(state);
        let i18nState = this.getStateText(state);
        this.sendMessage(senderPsid, message, itemName, i18nState);
      });
    }
  }

  notifyAllWithImageBase64(imageBase64) {
    let self = this;
    this.config.authorizedSenders.forEach((senderPsid) => {
      self.sendImageBase64(senderPsid, imageBase64);
    });
  }

  notifyAll() {
    let self = this;
    this.config.authorizedSenders.forEach((senderPsid) => {
      self.sendMessage.apply(self, [senderPsid].concat(Array.from(arguments)));
    });
  }

  getMessageText(message, args) {
    let string = this.getI18nString(message);
    return format.apply(this, [string].concat(args || []));
  }

  getStateText(value) {
    let propertyName = format("state.%s", value);
    let i18nValue = this.getI18nString(propertyName);
    return i18nValue === propertyName ? value : i18nValue;
  }

  getUpdateStateMessage(state) {
    let message = getProperty(this.dictionary, format('%s.%s', UPDATE_STATE_MESSAGE_MAPPING, state));
    return message ? format('message.%s', message) : MESSAGE_UPDATE;
  }

  getI18nString(propertyName) {
    let i18nString = getProperty(this.dictionary, propertyName);
    return i18nString ? i18nString : propertyName;
  }

  getButtonElements(title, text, options, entityDictionary) {
    return sliceArray(options, GRAPH_BUTTONS_PER_PAGE_LIMIT).map(pageOptions => {
      return {
        image_url: IMAGE_GET_INTENTS_URI,
        title: title,
        subtitle: text,
        buttons: this.getButtons(pageOptions, entityDictionary)
      }
    });
  }

  getButtons(options, entityDictionary) {
    return options.map(option => {
      let buttonText = this.getButtonText(option.missingNodes, entityDictionary);
      let payload = {
        itemNode: option.itemNode,
        value: option.value
      };
      return {
        type: 'postback',
        title: buttonText,
        payload: JSON.stringify(payload)
      }
    });
  }

  getButtonText(nodes, entityDictionary) {
    let isDataItemDefined = this.idDataItemDefined(nodes);
    return nodes
      .filter(node => !(isDataItemDefined && node.entity == OPENHAB_OPERATIONS))
      .reduce((acc, node, i) => {
        let entity = entityDictionary[node.entity];
        let prefix = this.getButtonTextPrefix(acc, i);
        return prefix + this.getValueMetadata(entity, node.value);
      }, '');
  }

  getButtonTextPrefix(value, i) {
    if (i == 0) return value;
    if (i == 1 && value.length > 2) return value + ' ';
    return value + ' ► ';
  }

  idDataItemDefined(nodes) {
    return nodes
      .filter(node => node.entity == OPENHAB_DATA_ITEM)
      .length > 0;
  }

  getValueMetadata(entity, value) {
    return entity.filter(entityValue => entityValue.value == value)
      .map(entityValue => entityValue.metadata)
      .reduce((acc, node) => node, value);
  }

  getEntityDictionary(options) {
    let entities = options.map(option => {
      return option.missingNodes.map(node => node.entity);
    }).reduce((acc, node) => acc.concat(node), []);
    let entityPromises = [...new Set(entities)]
      .map(entity => this.wit.entityValues(entity));
    return Promise.all(entityPromises)
      .then(this.toEntityDictionary);
  }

  toEntityDictionary(entities) {
    return entities.reduce((acc, node) => {
      acc[node.name] = node.values;
      return acc;
    }, {});
  }

  sendMessage() {
    let senderPsid = arguments[0];
    let message = arguments[1];
    let args = Array.from(arguments).slice(2);
    let text = this.getMessageText(message, args);
    this.fbMe.textMessage(senderPsid, text);
  }

  sendImageBase64(senderPsid, imageBase64) {
    let imageData = imageBase64.match(IMAGE_BASE64, 'i');
    let contentType = imageData[1];
    let imageType = imageData[2];
    let decodedImage = Buffer.from(imageData[3], 'base64');
    let filename = format("image.%s", imageType);
    this.fbMe.attachment(senderPsid, decodedImage, contentType, filename);
  }

  decodeAudio(buffer) {
    return new Promise((resolve, reject) => {
      audioContext.decodeAudioData(buffer, (audioBuffer) => resolve(Buffer.from(toWav(audioBuffer))));
    });
  }

  downloadAttachment(uri) {
    return new Promise((resolve, reject) => {
      let httpOptions = {
        uri: uri,
        method: 'GET',
        encoding: null
      };
      request(httpOptions, (err, res, body) => {
        if (err || res.statusCode != HttpStatus.OK) {
          log.error('Unable to send message: %s', JSON.stringify(err || res));
          log.error('Failed request: %s', JSON.stringify(httpOptions));
          reject(err || res);
        } else {
          resolve(body);
        }
      });
    });
  }


}

module.exports = Bot;
