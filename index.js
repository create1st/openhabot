'use strict';

const http = require('http');
const HttpStatus = require('http-status-codes');

class OpenHab {

  setItemValue(item, value, onData, onError) {
    console.log('Setting item value ' + item);
    this.sendHttpRequest(this.createSetItemStateOptions(item), value, onData, onError);
  }

  createSetItemStateOptions(item) {
    return {
	  host: '127.0.0.1',
      port: '8080',
      path: '/rest/items/' + item + '/state',
      method: 'PUT',
	  headers: {'Content-Type': 'text/plain'}
	};
  }

  sendHttpRequest(options, data, onData, onError) {
    var req = http.request(options, function(res) {
      if (res.statusCode == HttpStatus.ACCEPTED) {
        onData();
      }
      console.log('STATUS: ' + res.statusCode);
      console.log('HEADERS: ' + JSON.stringify(res.headers));
      res.setEncoding('utf8');
      res.on('data', function (chunk) {
        console.log('BODY: ' + chunk);
      });
    });
    req.on('error', function(e) {
      onError(e.message);
    });
    if (data) {
      req.write(data);
    }
    req.end();
  }
}

const
  fs = require('fs'),
  config = JSON.parse(fs.readFileSync('config.json', 'utf8'));
const
  express = require('express'),
  bodyParser = require('body-parser'),
  app = express().use(bodyParser.json());
const crypto = require('crypto');
const request = require('request');
const openHab = new OpenHab();

let appSecretPoof = crypto.createHmac('sha256', config.appSecret).update(config.accessToken).digest('hex');

app.listen(config.port, () => console.log('webhook is listening on port ' + config.port));
app.get('/webhook', (req, res) => {
  let mode = req.query['hub.mode'];
  let token = req.query['hub.verify_token'];
  let challenge = req.query['hub.challenge'];
  if (mode && token) {
    if (mode === 'subscribe' && token === config.verifyToken) {
      console.log('WEBHOOK_VERIFIED');
      res.status(HttpStatus.OK).send(challenge);
    } else {
      res.sendStatus(HttpStatus.FORBIDDEN);      
    }
  }
});
app.post('/webhook', (req, res) => {  
  let body = req.body;
  if (body.object === 'page') {
    body.entry.forEach(function(entry) {
      let webhook_event = entry.messaging[0];
      let senderPsid = webhook_event.sender.id;
      if (webhook_event.message) {
        handleMessage(senderPsid, webhook_event.message);
      } else if (webhook_event.postback) {
        handlePostback(senderPsid, webhook_event.postback);
      }
    });
    res.status(HttpStatus.OK).send('EVENT_RECEIVED');
  } else {
    res.sendStatus(HttpStatus.NOT_FOUND);
  }
});

function handleMessage(senderPsid, message) {
  let response;
  if (message.text) {    
    response = {
      "text": `You sent the message: "${message.text}". Now send me an image!`
    }
  }
  callSendAPI(senderPsid, response);   
}

function handlePostback(senderPsid, received_postback) {

}

function callSendAPI(senderPsid, response) {
  let request_body = {
	"appsecret_proof": appSecretPoof,
    "recipient": {
      "id": senderPsid
    },
    "message": response
  }
  request({
    "uri": "https://graph.facebook.com/v2.6/me/messages",
    "qs": { "access_token": config.accessToken },
    "method": "POST",
    "json": request_body
  }, (err, res, body) => {
    if (err) {
      console.error("Unable to send message:" + err);
    } else if (res.statusCode != HttpStatus.OK) {
      console.log('Failed to send message:' + JSON.stringify(res));
    }
  }); 
}