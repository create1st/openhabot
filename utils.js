format = function() {
    var string = arguments[0];
    var args = Array.from(arguments).slice(1);
    for (let i in args) {
        string = string.replace(/%[a-z]/, args[i]);
    }
    return string;
}

module.exports = { format };