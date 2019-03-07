'use strict';

const
  utils = require('./utils'),
  format = utils.format,
  Config = require('./config'),
  config = new Config(format('%s/config.json', __dirname)),
  sitemap = new Config(format('%s/sitemap.json', __dirname)),
  dictionary = new Config(format('%s/dictionary_%s.json', __dirname, config.language)),
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