const
  fs = require('fs'),
  express = require('express'),
  bodyParser = require('body-parser'),
  crypto = require('crypto'),
  request = require('request'),
  HttpStatus = require('http-status-codes'),
  utils = require('./utils'),
  format = utils.format;


class Bot {
  constructor(config, dictionary, wit, openHab) {
    this.config = config;
    this.openHab = openHab;
    this.appSecretPoof = crypto.createHmac('sha256', config.appSecret).update(config.accessToken).digest('hex');
    this.dictionary = dictionary;
    this.wit = wit;
    this.app = express().use(bodyParser.json());
  }

  start() {
    this.app.listen(this.config.port, () => console.log('webhook is listening on port %s', this.config.port));
    this.app.get('/webhook', (req, res) => {
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
    let self=this;
    this.app.post('/webhook', (req, res) => {  
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

  handleWebhookEvent({sender, message, postback}) {
    let senderPsid = sender.id;
    if (this.config.authorizedSenders.legth > 0 && !this.config.authorizedSenders.includes(senderPsid) && message) {
      this.handleUnauthorized(senderPsid);
    } else if (message) {
      this.handleMessage(senderPsid, message);
    } else if (postback) {
      this.handlePostback(senderPsid, postback);
    }
  }

  handleUnauthorized(senderPsid) {
    this.sendMessage(senderPsid, this.getResponseString('unauthorized'));  
  }

  handleMessage(senderPsid, {nlp, text, attachments}) {
    let self=this;
    if (text) {
      this.wit.message(text).then(({entities}) => {
        this.openHab.execute(entities, ({item, value, updated, err, res}) => {
          if (!item) {
            console.error('OpenHab sitemap lookup failed.');
            self.sendMessage(senderPsid, self.getResponseString('unrecognized_command'));
          } else if (err) {
            console.error('OpenHab error:', err);
            self.sendMessage(senderPsid, self.getResponseString('openhab_error', err));
          } else if (!updated && value) {
            console.log('OpenHab get value completed');
            self.sendMessage(senderPsid, self.getResponseString('get_value', value));
          } else if (!updated) {
            console.log('OpenHab get value completed');
            self.sendMessage(senderPsid, self.getResponseString('get_value_undefined'));
          } else {
            console.log('OpenHab set value completed');
            self.sendMessage(senderPsid, self.getResponseString('set_value'));
          }
        })  
      }).catch((err) => {
        console.error('Wit.Ai error:', err.stack || err);
        this.sendMessage(senderPsid, this.getResponseString('wit_error', err.stack || err)); 
      })
    } else {
      this.sendMessage(senderPsid, this.getResponseString('unsupported_message_type')); 
    } 
  }

  handlePostback(senderPsid, received_postback) {

  }

  getResponseString() {
    let responseId = arguments[0];
    let string = this.dictionary[responseId];
    let args = Array.from(arguments).slice(1);
    return format.apply(this, [string].concat(args));
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