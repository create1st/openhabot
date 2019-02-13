'use strict';

const http = require('http');

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
      if (res.statusCode == '202') {
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
  BootBot = require('bootbot'),
  bot = new BootBot(config);
const openHab = new OpenHab();

bot.on('message', (payload, chat) => {
  const text = payload.message.text;
  console.log(`The user said: ${text}`);
});

bot.hear([/ustaw .*/i], (payload, chat) => {
  try {
	console.log('Setting' + payload);
    var item = 'zwave_device_bca80c4e_node2_thermostat_setpoint_heating';
    var newValue = '123';
    openHab.setItemValue(item, newValue,
      function() {
        chat.say('Ustawiłem nową wartość ' + newValue + ' na urządzeniu ');
      },
      function(message) {
		chat.say('Wystąpił problem z ustawieniem wartości: ' + message);
      }
    );
  } catch(e) {
    console.log(e);
  }
});
bot.start(config.port);