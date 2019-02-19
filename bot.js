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
          console.log('WEBHOOK_VERIFIED');
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
        res.status(HttpStatus.OK).send('EVENT_RECEIVED');
      } else {
        res.sendStatus(HttpStatus.NOT_FOUND);
      }
    });
  }

  startHttpBindingApp() {
    let self=this;
    this.httpBindingApp.listen(this.config.openHabHttpBindingPort, () => console.log('openHab HttpBinding is listening on port %s', this.config.openHabHttpBindingPort));
    this.httpBindingApp.post('/rest/items/:item/state', (req, res) => {
      let updatedItem = req.params.item;
      let updatedState = this.getI18nValue(req.query.state);
      res.status(HttpStatus.OK).send('EVENT_RECEIVED');
      this.openHab.getItem(updatedItem,({item, value, updated, err, res}) => {
        let itemName = err ? updatedItem : value.label;
        self.config.authorizedSenders.forEach((senderPsid) => {
          self.sendMessage(senderPsid, self.getResponseString('message.update', itemName, updatedState));
        });
      });
    });
  }

  handleWebhookEvent({sender, message, postback}) {
    let senderPsid = sender ? sender.id : null;
    if (this.config.authorizedSenders.legth > 0 && !this.config.authorizedSenders.includes(senderPsid) && message) {
      this.handleUnauthorized(senderPsid);
    } else if (message) {
      this.handleMessage(senderPsid, message);
    } else if (postback) {
      this.handlePostback(senderPsid, postback);
    }
  }

  handleUnauthorized(senderPsid) {
    this.sendMessage(senderPsid, this.getResponseString('error.unauthorized', senderPsid));  
  }

  handleMessage(senderPsid, {nlp, text, attachments}) {
    let self=this;
    if (text) {
      this.wit.message(text).then(({entities}) => {
        this.openHab.execute(entities, ({item, value, updated, err, res}) => {
          if (!item) {
            console.error('OpenHab sitemap lookup failed.');
            self.sendMessage(senderPsid, self.getResponseString('error.unrecognized_command'));
          } else if (err) {
            console.error('OpenHab error:', err);
            self.sendMessage(senderPsid, self.getResponseString('error.openhab_call_failed', err));
          } else if (!updated && value && value != 'NULL') {
            console.log('OpenHab get value completed');
            self.sendMessage(senderPsid, self.getResponseString('message.get_value', this.getI18nValue(value)));
          } else if (!updated) {
            console.log('OpenHab get value completed');
            self.sendMessage(senderPsid, self.getResponseString('message.get_value_undefined'));
          } else {
            console.log('OpenHab set value completed');
            self.sendMessage(senderPsid, self.getResponseString('message.set_value'));
          }
        })  
      }).catch((err) => {
        console.error('Wit.Ai error:', err.stack || err);
        this.sendMessage(senderPsid, this.getResponseString('error.wit_call_failed', err.stack || err)); 
      })
    } else {
      this.sendMessage(senderPsid, this.getResponseString('error.unsupported_message_type')); 
    } 
  }

  handlePostback(senderPsid, received_postback) {

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
    this.callSendAPI(senderPsid, {"text": text}); 
  }

  callSendAPI(senderPsid, response) {
    let requestBody = {
    "appsecret_proof": this.appSecretPoof,
      "recipient": {
        "id": senderPsid
      },
      "message": response
    }
    request({
      "uri": "https://graph.facebook.com/v2.6/me/messages",
      "qs": { "access_token": this.config.accessToken },
      "method": "POST",
      "json": requestBody
    }, (err, res, body) => {
      if (err) {
        console.error('Unable to send message: %s', err);
      } else if (res.statusCode != HttpStatus.OK) {
        console.log('Failed to send message: %o', res);
      }
    }); 
  }
}

module.exports = Bot;