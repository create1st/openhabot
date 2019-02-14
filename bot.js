const
  express = require('express'),
  bodyParser = require('body-parser'),
  crypto = require('crypto'),
  request = require('request'),
  HttpStatus = require('http-status-codes');


class Bot {
  constructor(config, openHab) {
    this.config = config;
    this.openHab = openHab;
    this.appSecretPoof = crypto.createHmac('sha256', config.appSecret).update(config.accessToken).digest('hex');
    this.app = express().use(bodyParser.json());
  }

  start() {
    this.app.listen(this.config.port, () => console.log('webhook is listening on port ' + this.config.port));
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
        body.entry.forEach(function(entry) {
          self.handleWebhookEvent(entry.messaging[0])
        });
        res.status(HttpStatus.OK).send('EVENT_RECEIVED');
      } else {
        res.sendStatus(HttpStatus.NOT_FOUND);
      }
    });
  }

  handleWebhookEvent({sender, message, postback}) {
    let senderPsid = sender.id;
    if (!this.config.authorizedSenders.includes(senderPsid) && message) {
      this.handleUnauthorized(senderPsid);
    } else if (message) {
      this.handleMessage(senderPsid, message);
    } else if (postback) {
      this.handlePostback(senderPsid, postback);
    }
  }

  handleUnauthorized(senderPsid) {
    this.callSendAPI(senderPsid, {"text" : "You are not authorized to use this service. Your id has been recorded."});  
  }

  handleMessage(senderPsid, message) {
    console.log('message:' + JSON.stringify(message))
    let response;
    if (message.text) { 
      var item = 'zwave_device_bca80c4e_node2_thermostat_setpoint_heating';
      var newValue = '123';
      var callback = {};
      this.openHab.setItemValue(item, newValue, callback);
      response = {
        "text": callback.errorMessage
                ? 'Wystąpił problem z ustawieniem wartości: ' + callback.errorMessage
                : 'Ustawiłem nową wartość ' + newValue + ' na urządzeniu'
      }
    }
    this.callSendAPI(senderPsid, response);   
  }

  handlePostback(senderPsid, received_postback) {

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
        console.error("Unable to send message:" + err);
      } else if (res.statusCode != HttpStatus.OK) {
        console.log('Failed to send message:' + JSON.stringify(res, null, 4));
      }
    }); 
  }
}

module.exports = Bot;