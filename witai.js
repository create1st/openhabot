const
  log = require('loglevel').getLogger('witai'),
  utils = require('./utils'),
  request = require('request'),
  HttpStatus = require('http-status-codes'),
  {Wit, witLog} = require('node-wit'),
  format = utils.format;;

const
    WIT_AI_API_VERSION = '20160516',
    WIT_API_URL = 'https://api.wit.ai',
    SERVICE_ENTITIES = 'entities';

class WitAi extends Wit {
    constructor(config) {
        super({
            // logger: new witLog.Logger(log.DEBUG),
            accessToken: config.witAccessToken
            });
        this.config = config;
    }

    entities() {
        let self = this;
        return new Promise((resolve, reject) => {
            self.sendWitAiRequest(SERVICE_ENTITIES, resolve, reject);
        });
    }

    entityValues(entity) {
        let self = this;
        return new Promise((resolve, reject) => {
            self.sendWitAiRequest(format('%s/%s', SERVICE_ENTITIES, entity), resolve, reject);
        });
    }

    sendWitAiRequest(service, resolve, reject) {
        let httpOptions = {
            uri: format('%s/%s', WIT_API_URL, service),
            headers: {
                'Authorization': format('Bearer %s', this.config.witAccessToken),
                'Accept': format('application/vnd.wit.%sjson', WIT_AI_API_VERSION),
                'Content-Type': 'application/json',
            },
            method: 'GET'
        };
        request(httpOptions, (err, res, body) => {
            if (err || res.statusCode != HttpStatus.OK) {
                log.error('Unable to send message: %s', JSON.stringify(err || res));
                log.error('Failed request: %s', JSON.stringify(httpOptions));
                reject(err);
            }
            resolve(JSON.parse(body.toString('utf8')));
        }); 
    }
}

module.exports = WitAi;