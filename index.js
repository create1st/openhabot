'use strict';

const
  fs = require('fs'),
  config = JSON.parse(fs.readFileSync('config.json', 'utf8')),
  sitemap = JSON.parse(fs.readFileSync('sitemap.json', 'utf8')),
  utils = require('./utils'),
  format = utils.format,
  dictionary = JSON.parse(fs.readFileSync(format('dictionary_%s.json', config.language), 'utf8')),
  {Wit, log} = require('node-wit'),
  Bot = require('./bot'),
  OpenHab = require('./openhab');
const openHab = new OpenHab(config, sitemap);
const wit = new Wit({
      // logger: new log.Logger(log.DEBUG),
      accessToken: config.witAccessToken
    });
const bot = new Bot(config, dictionary, wit, openHab);
bot.start();