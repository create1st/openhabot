const
  fs = require('fs');

const
  CONFIG_FILE = 'getConfigFile';

class Config {
  constructor(configFile) {
    this.getConfigFile = function() { return configFile; }
    this.reload();
  }

  reload() {
    let content = fs.readFileSync(this.getConfigFile(), 'utf8')
    let config = JSON.parse(content);
    for (let property in this) {
      if (property != CONFIG_FILE) {
        delete this[property];
      }
    }
    for (let property in config) {
      this[property]=config[property];
    }
  }
}

module.exports = Config;