(function () {
  'use strict';
}());

const
  logger = require('./logger'),
  configureLogger = logger.configureLogger,
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

configureLogger(config.logFile);
const lookup = new Lookup(config, sitemap);
const openHab = new OpenHab(config);
const witAi = new WitAi(config);
const bot = new Bot(config, dictionary, witAi, openHab, lookup);
bot.start();
registerRestartHook();