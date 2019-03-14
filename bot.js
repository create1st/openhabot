const
  log = require('loglevel').getLogger('bot'),
  express = require('express'),
  bodyParser = require('body-parser'),
  crypto = require('crypto'),
  request = require('request'),
  HttpStatus = require('http-status-codes'),
  utils = require('./utils'),
  getProperty = require('lodash/get'),
  format = utils.format,
  sliceArray = utils.sliceArray;

const
  OPENHAB_DATA_ITEM = 'openhab_data_item',
  OPENHAB_OPERATIONS = 'openhab_operations',
  IMAGE_GET_INTENTS_URI = 'https://www.iconfinder.com/icons/17821/download/png/128',
  GRAPH_BUTTONS_PER_PAGE_LIMIT = 3,
  GRAPH_ELEMENTS_LIMIT = 10,
  GRAPH_BUTTON_ELEMENTS_LIMIT = GRAPH_BUTTONS_PER_PAGE_LIMIT * GRAPH_ELEMENTS_LIMIT,
  GRAPH_API_URL = 'https://graph.facebook.com/v2.6/me/messages',
  IMAGE_BASE64 = new RegExp('^data:(image\/(.*));base64,(.*)$'),
  RESPONSE_EVENT_RECEIVED = 'EVENT_RECEIVED',
  RESPONSE_UPDATED = 'UPDATED',
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
  constructor(config, dictionary, wit, openHab) {
    this.config = config;
    this.openHab = openHab;
    this.appSecretPoof = crypto.createHmac('sha256', config.appSecret).update(config.accessToken).digest('hex');
    this.dictionary = dictionary;
    this.wit = wit;
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
    let self=this;
    this.webhookApp.listen(this.config.webhookPort, () => log.info('webhook is listening on port %s', this.config.webhookPort));
    this.webhookApp.get('/webhook', (req, res) => {
      let mode = req.query['hub.mode'];
      let token = req.query['hub.verify_token'];
      let challenge = req.query['hub.challenge'];
      if (mode && token) {
        if (mode === 'subscribe' && token === this.config.verifyToken) {
          log.debug('Webhook authorized by Facebook application');
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
        this.openHab.getItem(updatedItem, ({item, value, updated, err, res}) => {
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
      this.openHab.reloadConfigs();
      res.status(HttpStatus.OK).send(RESPONSE_UPDATED);
      this.notifyAll(MESSAGE_CONFIG_REFRESH);
    });
  }

  handleWebhookEvent({sender, message, postback}) {
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

  handleMessage(senderPsid, {nlp, text, attachments}) {
    var request = this.lastResponse[senderPsid];
    if (request) {
      delete this.lastResponse[senderPsid];
      let value = parseFloat(text);
      if (isNaN(value)) {
        this.sendMessage(senderPsid, MESSAGE_UNRECOGNIZED_COMMAND);
      } else {
        request.value = value;
        this.openHab.executeApiCall(null, request, (callback) => this.openHabResponseHandler(senderPsid, callback));
      }
    } else if (text) {
      let queryString = text.toString('utf8');
      this.sendTypingOn(senderPsid);
      this.wit.message(queryString).then(({entities}) => {
        this.openHab.execute(queryString, entities, (callback) => this.openHabResponseHandler(senderPsid, callback));
      }).catch((err) => {
        log.error('Wit.Ai error:', err.stack || err);
        this.sendMessage(senderPsid, ERROR_WIT_CALL_FAILED, err.stack || err); 
      })
    } else {
      this.sendMessage(senderPsid, ERROR_UNSUPPORTED_MESSAGE_TYPE); 
    } 
  }

  handlePostback(senderPsid, postback) {
    let userSelection = JSON.parse(postback.payload);
    let request = {
      itemNode: userSelection.itemNode,
      value: 'value' in userSelection ? userSelection.value : undefined
    };
    this.sendTypingOn(senderPsid);
    this.openHab.executeApiCall(null, request, (callback) => this.openHabResponseHandler(senderPsid, callback));
  }

  async openHabResponseHandler(senderPsid, {item, value, updated, err, req, res}) {
    if (!item) {
      if (res.length == 0 || res.length > GRAPH_BUTTON_ELEMENTS_LIMIT) {
        log.error('OpenHab sitemap lookup failed.');
        this.sendMessage(senderPsid, MESSAGE_UNRECOGNIZED_COMMAND);              
      } else {
          log.trace('Select options: %o', res);
          let [entityDictionary, error] = await this.getEntityDictionary(res);
          if (error) {
            log.error('Wit.Ai error:', error.stack || error);
            this.sendMessage(senderPsid, ERROR_WIT_CALL_FAILED, error.stack || error);             
          } else {
            let title = this.getMessageText(MESSAGE_SELECT_OPTION);
            let elements = this.getButtonElements(title, req, res, entityDictionary);
            this.callSendGenericTemplateAPI(senderPsid, elements);
          }
      }
    } else if (value === undefined) {
        log.trace('Provide value: %o', res);
        if (typeof item == 'object') {
          log.debug('Item node %o', item)
          this.sendMessage(senderPsid, MESSAGE_UNRECOGNIZED_COMMAND);   
        } else {
          this.lastResponse[senderPsid] = res;
          this.sendMessage(senderPsid, MESSAGE_MISSING_VALUE);
        }
    } else if (err) {
      log.error('OpenHab error:', err);
      this.sendMessage(senderPsid, ERROR_OPENHAB_CALL_FAILED, err);
    } else if (!updated) {
      log.trace('OpenHab get value completed');
      if (value == null || value == 'NULL') {
        this.sendMessage(senderPsid, MESSAGE_GET_VALUE_UNDEFINED);            
      } else if (value.match(IMAGE_BASE64)) {
        this.sendImageBase64(senderPsid, value);
      } else {
        let i18nState = this.getStateText(state)
        this.sendMessage(senderPsid, MESSAGE_GET_VALUE, i18nState);              
      }
    } else {
      log.trace('OpenHab set value completed');
      let state = value;
      this.openHab.getItem(item, ({value, err}) => {
        let itemName = err ? item : value.label;
        let message = this.getUpdateStateMessage(state);
        let i18nState = this.getStateText(state)          
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
    let message = getProperty(this.dictionary, format('%s.%s', UPDATE_STATE_MESSAGE_MAPPING,state));
    return message ? message : MESSAGE_UPDATE;
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
    let invertedNodes = nodes.slice().reverse();
    let isDataItemDefined = this.idDataItemDefined(nodes);
    return invertedNodes
      .filter(node => !(isDataItemDefined && node.entity == OPENHAB_OPERATIONS))
      .reduce((acc, node) => {
        let entity = entityDictionary[node.entity];
        let prefix = acc ? acc + '->' : acc;
        return prefix + this.getValueMetadata(entity, node.value);
      }, '');
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
      .then(this.toEntityDictionary)
      .then(dictionary => [dictionary, null])
      .catch(err => [null, err]);
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
    this.callSendTextAPI(senderPsid, text); 
  }

  sendImageBase64(senderPsid, imageBase64) {
    let imageData = imageBase64.match(IMAGE_BASE64, 'i');
    let contentType = imageData[1];
    let imageType = imageData[2];
    let decodedImage = Buffer.from(imageData[3], 'base64');
    let filename = format("image.%s", imageType);
    this.callSendAttachmentAPI(senderPsid, decodedImage, contentType, filename); 
  }

  callSendAttachmentAPI(senderPsid, buffer, contentType, filename) {
    let assetType = contentType.split('/')[0];
    let httpOptions = {
      uri: GRAPH_API_URL,
      qs: { access_token: this.config.accessToken },
      method: 'POST'
    };
    var postRequest = request(httpOptions,  (err, res, body) => {
      if (err || res.statusCode != HttpStatus.OK) {
        log.error('Unable to send message: %s', JSON.stringify(err));
        log.error('Failed request: %s', JSON.stringify(httpOptions));
      } else if (body) {
        let attachment = JSON.parse(body);
        log.trace('Sent attachment with id: %s', attachment.attachment_id);
      }
    });
    var form = postRequest.form();
    form.append('appsecret_proof', this.appSecretPoof);
    form.append('recipient', format("{ \"id\": \"%s\"}", senderPsid));
    form.append('message', format("{ \"attachment\": { \"type\": \"%s\", \"payload\": { \"is_reusable\": true}}}", assetType));
    form.append('filedata', buffer, { filename: filename, contentType: contentType });
  }

  callSendGenericTemplateAPI(senderPsid, elements) {
    let message = {
      attachment: {
        type: 'template',
        payload: {
          image_aspect_ratio: 'square',
          template_type: 'generic',
          elements: elements
        }
      }
    };
    this.callSendAPI(senderPsid, message);
  }

  callSendTextAPI(senderPsid, text) {
    this.callSendAPI(senderPsid, { text: text }) ;
  }

  callSendAPI(senderPsid, message) {
    let requestBody = {
      appsecret_proof: this.appSecretPoof,
      recipient: { id: senderPsid },
      message: message
    };
    this.sendRequest(requestBody) 
  }
  
  sendTypingOn(senderPsid) {
    this.callSenderActionAPI(senderPsid, 'typing_on');
  }

  callSenderActionAPI(senderPsid, senderAction) {
    let requestBody = {
      appsecret_proof: this.appSecretPoof,
      recipient: { id: senderPsid },
      sender_action: senderAction
    };
    this.sendRequest(requestBody) 
  }

  sendRequest(requestBody) {
    let httpOptions = {
      uri: GRAPH_API_URL,
      qs: { access_token: this.config.accessToken },
      method: 'POST',
      json: requestBody
    };
    request(httpOptions, (err, res, body) => {
      if (err || res.statusCode != HttpStatus.OK) {
        log.error('Unable to send message: %s', JSON.stringify(err || res));
        log.error('Failed request: %s', JSON.stringify(httpOptions));
      }
    }); 
  }
}

module.exports = Bot;