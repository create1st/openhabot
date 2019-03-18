const
    log = require('loglevel').getLogger('fbme'),
    crypto = require('crypto'),
    request = require('request'),
    HttpStatus = require('http-status-codes'),
    utils = require('./utils'),
    format = utils.format;

const
    GRAPH_API_URL = 'https://graph.facebook.com/v2.6/me/messages';

class FbMe {
    constructor(config) {
        this.config = config;
        this.appSecretPoof = crypto.createHmac('sha256', config.appSecret).update(config.accessToken).digest('hex');
    }

    attachment(senderPsid, buffer, contentType, filename) {
        let assetType = contentType.split('/')[0];
        let httpOptions = {
            uri: GRAPH_API_URL,
            qs: {
                access_token: this.config.accessToken
            },
            method: 'POST'
        };
        var postRequest = request(httpOptions, (err, res, body) => {
            if (err || res.statusCode != HttpStatus.OK) {
                log.error('Unable to send message: %s', JSON.stringify(err));
                log.error('Failed request: %s', JSON.stringify(httpOptions));
            } else if (body) {
                let attachment = JSON.parse(body);
                log.trace('Sent attachment with id: %s', attachment.attachment_id);
            }
        });
        var form = postRequest.form();
        form.append('appsecret_proof', this.appSecretPoof);
        form.append('recipient', format("{ \"id\": \"%s\"}", senderPsid));
        form.append('message', format("{ \"attachment\": { \"type\": \"%s\", \"payload\": { \"is_reusable\": true}}}", assetType));
        form.append('filedata', buffer, {
            filename: filename,
            contentType: contentType
        });
    }

    genericTemplate(senderPsid, elements) {
        let message = {
            attachment: {
                type: 'template',
                payload: {
                    image_aspect_ratio: 'square',
                    template_type: 'generic',
                    elements: elements
                }
            }
        };
        this.callSendAPI(senderPsid, message);
    }

    textMessage(senderPsid, text) {
        this.callSendAPI(senderPsid, {
            text: text
        });
    }

    typingOn(senderPsid) {
        this.callSenderActionAPI(senderPsid, 'typing_on');
    }

    callSendAPI(senderPsid, message) {
        let requestBody = {
            appsecret_proof: this.appSecretPoof,
            recipient: {
                id: senderPsid
            },
            message: message
        };
        this.sendRequest(requestBody)
    }

    callSenderActionAPI(senderPsid, senderAction) {
        let requestBody = {
            appsecret_proof: this.appSecretPoof,
            recipient: {
                id: senderPsid
            },
            sender_action: senderAction
        };
        this.sendRequest(requestBody)
    }

    sendRequest(requestBody) {
        let httpOptions = {
            uri: GRAPH_API_URL,
            qs: {
                access_token: this.config.accessToken
            },
            method: 'POST',
            json: requestBody
        };
        request(httpOptions, (err, res, body) => {
            if (err || res.statusCode != HttpStatus.OK) {
                log.error('Unable to send message: %s', JSON.stringify(err || res));
                log.error('Failed request: %s', JSON.stringify(httpOptions));
            }
        });
    }
}

module.exports = FbMe;