var path = require("path");
var program = require("commander");
var fs = require("fs");
var jsdeps = require("./jsdeps");
var pkg = require("../package.json")
// Parses the command line arguments into an object
var processArgs = function (argv, cwd) {
    // TODO improve cli to update existing file 
    program
        .version(pkg.version)
        .description('Parse references in javascript file and build metadata')
        .option("-s, --sourcePath [path]", "Recursively search for js files here. Defaults to current directory.")
        .option("-x, --xml", "Render output as XML (JSON is the default).")
        .option("-d, --dest [path]", "Write json/xml file to this location. Defaults to stdout.", false)
        .parse(argv);
    program.sourcePath = path.resolve(cwd, program.sourcePath || program.args[0] || "");
    return program;
};

exports.main = function (stdout, stderr, argv, cwd) {
    var options = processArgs(argv, cwd);
    var dependencyFileContent = jsdeps.buildDependencies(options);
    if (options.dest) {
        fs.writeFileSync(options.dest, dependencyFileContent);
    } else {
        stdout.write(dependencyFileContent);
    }
};
