'use strict';

const
  fs = require('fs'),
  config = JSON.parse(fs.readFileSync('config.json', 'utf8')),
  Bot = require('./bot'),
  OpenHab = require('./openhab');
const openHab = new OpenHab();
const bot = new Bot(config, openHab);
bot.start();