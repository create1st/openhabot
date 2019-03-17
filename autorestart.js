const
  childProcess = require('child_process');

registerRestartHook = function () {
  process.on('exit', function () {
    childProcess.spawn(process.argv.shift(), process.argv, {
      cwd: process.cwd(),
      detached: true,
      stdio: 'inherit'
    });
  });
};

module.exports = {
  registerRestartHook
};