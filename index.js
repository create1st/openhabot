'use strict';

const
  log = require('loglevel'),
  loglevelStdStreams = require('loglevel-std-streams'),
  utils = require('./utils'),
  format = utils.format,
  Config = require('./config'),
  config = new Config(format('%s/config.json', __dirname)),
  sitemap = new Config(format('%s/sitemap.json', __dirname)),
  dictionary = new Config(format('%s/dictionary_%s.json', __dirname, config.language)),
  {Wit, witLog} = require('node-wit'),
  Bot = require('./bot'),
  OpenHab = require('./openhab');
log.getLogger('bot').setLevel('DEBUG');
log.getLogger('openhab').setLevel('DEBUG');
loglevelStdStreams(log);
const openHab = new OpenHab(config, sitemap);
const wit = new Wit({
      // logger: new witLog.Logger(log.DEBUG),
      accessToken: config.witAccessToken
    });
const bot = new Bot(config, dictionary, wit, openHab);
bot.start();