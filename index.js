(function () {
  'use strict';
}());

const
  log = require('loglevel'),
  loglevelStdStreams = require('loglevel-std-streams'),
  utils = require('./utils'),
  format = utils.format,
  Config = require('./config'),
  config = new Config(format('%s/config.json', __dirname)),
  sitemap = new Config(format('%s/sitemap.json', __dirname)),
  dictionary = new Config(format('%s/dictionary_%s.json', __dirname, config.language)),
  WitAi = require('./witai'),
  Bot = require('./bot'),
  OpenHab = require('./openhab');
log.getLogger('bot').setLevel('DEBUG');
log.getLogger('openhab').setLevel('DEBUG');
log.getLogger('witai').setLevel('DEBUG');
loglevelStdStreams(log);
const openHab = new OpenHab(config, sitemap);
const witAi = new WitAi(config);
const bot = new Bot(config, dictionary, witAi, openHab);
bot.start();