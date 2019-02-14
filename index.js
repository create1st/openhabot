'use strict';

const
  fs = require('fs'),
  config = JSON.parse(fs.readFileSync('config.json', 'utf8')),
  sitemap = JSON.parse(fs.readFileSync('sitemap.json', 'utf8')),
  Bot = require('./bot'),
  OpenHab = require('./openhab');
const openHab = new OpenHab(config, sitemap);
const bot = new Bot(config, openHab);
bot.start();