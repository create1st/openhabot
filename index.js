'use strict';

const
  Config = require('./config'),
  config = new Config('./config.json'),
  sitemap = new Config('./sitemap.json'),
  utils = require('./utils'),
  format = utils.format,
  dictionary = new Config(format('./dictionary_%s.json', config.language)),
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