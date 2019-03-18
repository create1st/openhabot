const
    fs = require('fs'),
    log = require('loglevel'),
    loglevelStdStreams = require('loglevel-std-streams');

configureLogger = function (logFile) {
    log.getLogger('bot').setLevel('DEBUG');
    log.getLogger('openhab').setLevel('DEBUG');
    log.getLogger('witai').setLevel('DEBUG');
    log.getLogger('lookup').setLevel('DEBUG');
    log.getLogger('fbme').setLevel('DEBUG');
    loglevelStdStreams(log);
    let logAccess = fs.createWriteStream(logFile);
    process.stdout.write = process.stderr.write = logAccess.write.bind(logAccess);
};

module.exports = {
    configureLogger
};