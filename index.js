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
  Lookup = require('./lookup'),
  OpenHab = require('./openhab'),
  autorestart = require('./autorestart'),
  registerRestartHook = autorestart.registerRestartHook;

log.getLogger('bot').setLevel('DEBUG');
log.getLogger('openhab').setLevel('DEBUG');
log.getLogger('witai').setLevel('DEBUG');
log.getLogger('lookup').setLevel('DEBUG');
loglevelStdStreams(log);
const lookup = new Lookup(config, sitemap);
const openHab = new OpenHab(config);
const witAi = new WitAi(config);
const bot = new Bot(config, dictionary, witAi, openHab, lookup);
bot.start();
registerRestartHook();