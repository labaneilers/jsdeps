var path = require("path");
var nomnom = require("nomnom");
var FileReader = require("n-readlines");
var fs = require("fs");

var fsutil = require("./file-system-util");

// Parses the command line arguments into an object
var processArgs = function (argv, cwd) {

    var args = nomnom
        .script("jsdeps <path>...")
        .option("root", {
            abbr: "r",
            help: "The application root directory"
        })
        .option("help", {
            abbr: "h",
            flag: true,
            help: "Show help"
        })
        .option("xml", {
            abbr: "x",
            flag: true,
            help: "Render output as XML (JSON is the default)"
        })
        .parse();

    var sourcePath = cwd;

    if (args._.length >= 1) {
        sourcePath = path.resolve(cwd, args._[0]);
    }

    args.sourcePath = sourcePath;

    if (!args.root) {
        args.root = args.sourcePath;
    }

    return args;
};

var REF_REGEX = /\/\/\/\s*<reference\s*path\s*=\s*[\"\']{1}([^\"\']*)[\"\']{1}/gi;

var getReferences = function(absolutePath) {
    var reader = new FileReader(absolutePath);
    var line;
    var result = [];
    while (line = reader.next()) {
        line = line.toString();
        var matches = REF_REGEX.exec(line);
        if (matches) {
            result.push(matches[1]);
        }
    }

    return result;
};

var getRootRelativePath = function (root, absolutePath) {
    return "/" + path.relative(root, absolutePath).replace(/\\/g, "/");
};

var processFile = function (absolutePath, options, depTree) {

    var parentDirectory = path.dirname(absolutePath);

    var refs = getReferences(absolutePath)
        .map(function (x) { return path.resolve(parentDirectory, x); });

    if (refs.length === 0) {
        return;
    }

    refs.forEach(function (x) {
        if (!fs.existsSync(x)) {
            throw new Error("'" + x + "'' cannot be not found\n(referenced from '" + absolutePath + "'')");
        }
    });

    depTree[getRootRelativePath(options.root, absolutePath)] = refs
        .map(function (x) { return getRootRelativePath(options.root, x); });
};

var isDirectoryIgnored = function (absolutePath) {
    return fs.existsSync(path.join(absolutePath, "jslignore.txt"));
};

var formatXml = function(depTree) {
    var xml = "<?xml version=\"1.0\"?>\n" +
        "<dependencies xmlns=\"http://schemas.vistaprint.com/VP.Cap.Dev.JavaScriptDependencies.Dependency.xsd\">\n";

    for (var f in depTree) {
        xml += "  <file path=\"" + f + "\">\n";
        xml += depTree[f].map(function (x) { return "    <dependency>" + x + "</dependency>"; }).join("\n") + "\n";
        xml += "  </file>\n";
    }

    xml += "</dependencies>\n";

    return xml;
};

var formatJson = function(depTree) {
    return JSON.stringify(depTree, null, 2) + "\n";
};

exports.main = function (stdout, stderr, argv, cwd) {

    var options = processArgs(argv, cwd, stderr);

    var files = [];
    var depTree = {};

    try {
        fsutil.recurseDirSync(
            options.sourcePath, 
            function (x) { 
                files.push(x); 
                processFile(x, options, depTree); 
            },
            function (x) { return !isDirectoryIgnored(x); }
        );
    } catch (ex) {
        stderr.write(ex.message + "\n");
        return -1;
    }

    stdout.write(options.xml ? formatXml(depTree) : formatJson(depTree));

    return 0;
};