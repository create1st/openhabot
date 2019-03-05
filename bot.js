const
  fs = require('fs'),
  express = require('express'),
  bodyParser = require('body-parser'),
  crypto = require('crypto'),
  request = require('request'),
  HttpStatus = require('http-status-codes'),
  utils = require('./utils'),
  getProperty = require('lodash/get'),
  format = utils.format;

const
  IMAGE_BASE64 = new RegExp('^data:(image\/(.*));base64,(.*)$'),
  RESPONSE_EVENT_RECEIVED = 'EVENT_RECEIVED',
  RESPONSE_UPDATED = 'UPDATED',
  MESSAGE_BOT_STARTED = 'message.bot_started',
  MESSAGE_CONFIG_REFRESH = 'message.config_refresh',
  MESSAGE_UPDATE = 'message.update',
  MESSAGE_UNRECOGNIZED_COMMAND = 'message.unrecognized_command',
  MESSAGE_GET_VALUE = 'message.get_value',
  MESSAGE_GET_VALUE_UNDEFINED = 'message.get_value_undefined',
  MESSAGE_SET_VALUE = 'message.set_value',
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
  }

  start() {
    this.startWebHookApp();
    this.startHttpBindingApp();
    this.notifyAll(this.getResponseString(MESSAGE_BOT_STARTED));
  }
  
  startWebHookApp() {
    let self=this;
    this.webhookApp.listen(this.config.webhookPort, () => console.log('webhook is listening on port %s', this.config.webhookPort));
    this.webhookApp.get('/webhook', (req, res) => {
      let mode = req.query['hub.mode'];
      let token = req.query['hub.verify_token'];
      let challenge = req.query['hub.challenge'];
      if (mode && token) {
        if (mode === 'subscribe' && token === this.config.verifyToken) {
          console.log('Webhook authorized by Facebook application');
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
            if (event.message && !event.message.is_echo) {
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
    this.httpBindingApp.listen(this.config.openHabHttpBindingPort, () => console.log('openHab HttpBinding is listening on port %s', this.config.openHabHttpBindingPort));
    this.httpBindingApp.post('/rest/items/:item/state', (req, res) => {
      res.status(HttpStatus.OK).send(RESPONSE_EVENT_RECEIVED);
      let updatedItem = req.params.item;
      let state = req.query.state;
      if (state && state.match(IMAGE_BASE64)) {
        this.notifyAllWithImageBase64(state);
      } else {
        let i18nState = this.getI18nValue(state);
        this.openHab.getItem(updatedItem, ({item, value, updated, err, res}) => {
          let itemName = err ? updatedItem : value.label;
          this.notifyAll(this.getResponseString(MESSAGE_UPDATE, itemName, i18nState));
        });
      }
    });
    this.httpBindingApp.post('/rest/system/config/reload', (req, res) => {
      console.log('Refreshing configuration');
      this.config.reload();
      this.dictionary.reload();
      this.openHab.reloadConfigs();
      res.status(HttpStatus.OK).send(RESPONSE_UPDATED);
      this.notifyAll(this.getResponseString(MESSAGE_CONFIG_REFRESH));
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
    this.sendMessage(senderPsid, this.getResponseString(ERROR_UNAUTHORIZED, senderPsid));  
  }

  handleMessage(senderPsid, {nlp, text, attachments}) {
    let self=this;
    if (text) {
      this.wit.message(text).then(({entities}) => {
        this.openHab.execute(entities, ({item, value, updated, err, res}) => {
          if (!item) {
            console.error('OpenHab sitemap lookup failed.');
            self.sendMessage(senderPsid, self.getResponseString(MESSAGE_UNRECOGNIZED_COMMAND));
          } if (typeof item == 'object') {
            console.log('OpenHab query not completed: %o', item);
          } else if (err) {
            console.error('OpenHab error:', err);
            self.sendMessage(senderPsid, self.getResponseString(ERROR_OPENHAB_CALL_FAILED, err));
          } else if (!updated) {
            console.log('OpenHab get value completed');
            if (value == null || value == 'NULL') {
              self.sendMessage(senderPsid, self.getResponseString(MESSAGE_GET_VALUE_UNDEFINED));            
            } else if (value.match(IMAGE_BASE64)) {
              self.sendImageBase64(senderPsid, value);
            } else {
              self.sendMessage(senderPsid, self.getResponseString(MESSAGE_GET_VALUE, this.getI18nValue(value)));              
            }
          } else {
            console.log('OpenHab set value completed');
            self.sendMessage(senderPsid, self.getResponseString(MESSAGE_SET_VALUE));
          }
        })  
      }).catch((err) => {
        console.error('Wit.Ai error:', err.stack || err);
        this.sendMessage(senderPsid, this.getResponseString(ERROR_WIT_CALL_FAILED, err.stack || err)); 
      })
    } else {
      this.sendMessage(senderPsid, this.getResponseString(ERROR_UNSUPPORTED_MESSAGE_TYPE)); 
    } 
  }

  handlePostback(senderPsid, received_postback) {

  }

  notifyAllWithImageBase64(imageBase64) {
    let self = this;
    this.config.authorizedSenders.forEach((senderPsid) => {
      self.sendImageBase64(senderPsid, imageBase64);
    });
  }

  notifyAll(message) {
    let self = this;
    this.config.authorizedSenders.forEach((senderPsid) => {
      self.sendMessage(senderPsid, message);
    });
  }

  getResponseString() {
    let responseId = arguments[0];
    let string = this.getI18nString(responseId);
    let args = Array.from(arguments).slice(1);
    return format.apply(this, [string].concat(args));
  }

  getI18nValue(value) {
    let propertyName = format("state.%s", value);
    let i18nValue = this.getI18nString(propertyName);
    return i18nValue === propertyName ? value : i18nValue;
  }

  getI18nString(propertyName) {
    let i18nString = getProperty(this.dictionary, propertyName);
    return i18nString ? i18nString : propertyName;
  }

  sendMessage(senderPsid, text) {
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
      "uri": "https://graph.facebook.com/v2.6/me/messages",
      "qs": { "access_token": this.config.accessToken },
      "method": "POST"
    };
    var postRequest = request(httpOptions,  (err, res, body) => {
      if (err || res.statusCode != HttpStatus.OK) {
        console.error('Unable to send message: %s', JSON.stringify(err));
        console.error('Failed request: %s', JSON.stringify(httpOptions));
      } else if (body) {
        let attachment = JSON.parse(body);
        console.log("Sent attachment with id: %s", attachment.attachment_id);
      }
    });
    var form = postRequest.form();
    form.append('appsecret_proof', this.appSecretPoof);
    form.append('recipient', format("{ \"id\": \"%s\"}", senderPsid));
    form.append('message', format("{ \"attachment\": { \"type\": \"%s\", \"payload\": { \"is_reusable\": true}}}", assetType));
    form.append('filedata', buffer, { filename: filename, contentType: contentType });
  }

  callSendTextAPI(senderPsid, text) {
    let requestBody = {
      "appsecret_proof": this.appSecretPoof,
      "recipient": { "id": senderPsid },
      "message": { "text": text }
    };
    let httpOptions = {
      "uri": "https://graph.facebook.com/v2.6/me/messages",
      "qs": { "access_token": this.config.accessToken },
      "method": "POST",
      "json": requestBody
    };
    request(httpOptions, (err, res, body) => {
      if (err || res.statusCode != HttpStatus.OK) {
        console.error('Unable to send message: %s', JSON.stringify(err));
        console.error('Failed request: %s', JSON.stringify(httpOptions));
      }
    }); 
  }
}

module.exports = Bot;