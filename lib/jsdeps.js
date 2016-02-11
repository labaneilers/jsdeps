var path = require("path");
var fs = require("fs");

var fsutil = require("./file-system-util");

var REF_REGEX = /\/\/\/\s*<reference\s+path\s*=\s*["'](.*?)["']/gim;
var matchAll = function(str, regex) {
    var res = [];
    var currentMatch;
    if (regex.global) {
        while (currentMatch = regex.exec(str)) {
            res.push(currentMatch[1]);
        }
    } else {
        if (currentMatch = regex.exec(str)) {
            res.push(currentMatch[1]);
        }
    }
    return res;
};
var getReferences = function(absolutePath) {
    var file = fs.readFileSync(absolutePath, {encoding:"utf8"});
    return matchAll(file, REF_REGEX);
};

var getPrefixRelativePath = function(prefix, absolutePath) {
    return "/" + path.relative(prefix, absolutePath).replace(/\\/g, "/");
};

var processFile = function(absolutePath, options, sourcePathToDependencies) {
    var sourcePath = getPrefixRelativePath(options.pathPrefix, absolutePath);
    delete sourcePathToDependencies[sourcePath];
    
    var parentDirectory = path.dirname(absolutePath);

    var dependencies = getReferences(absolutePath).map(function(dependency) {
        return path.resolve(parentDirectory, dependency);
    });

    if (dependencies.length === 0) {
        return;
    }

    dependencies.map(function(dependency) {
        if (!fs.existsSync(dependency)) {
            throw "'" + dependency + "'' cannot be not found\n(referenced from '" + absolutePath + "'')";
        }
    });

    sourcePathToDependencies[sourcePath] = dependencies.map(function(referencePath) {
        return getPrefixRelativePath(options.pathPrefix, referencePath);
    });
};

var createXMLStringFromTree = function(sourcePathToDependencies) {
    var xml = "<?xml version=\"1.0\"?>\n" +
    "<dependencies xmlns=\"http://schemas.vistaprint.com/VP.Cap.Dev.JavaScriptDependencies.Dependency.xsd\">\n";

    for (var sourcePath in sourcePathToDependencies) {
        xml += "  <file path=\"" + sourcePath + "\">\n";
        /*jshint -W083 */
        xml += sourcePathToDependencies[sourcePath].map(function(dependencyPath) {
            return "    <dependency>" + dependencyPath + "</dependency>";
        }).join("\n") + "\n";
        xml += "  </file>\n";
    }
    xml += "</dependencies>\n";

    return xml;
};

var createJSONStringFromTree = function(sourcePathToDependencies) {
    // Takes a sourcePathToDependencies: {"a.js":["b.js","c.js"], "b.js":["d.js"]} 
    // returns formatedSourcePathToDependencies as json string: '[{source:"a.js", dependencies:["b.js","c.js"]},{source:"b.js", dependencies:["d.js"]}]'
    var formatedSourcePathToDependencies = [];
    var spaces = 2;
    for (var sourcePath in sourcePathToDependencies) {
        if (sourcePathToDependencies.hasOwnProperty(sourcePath)) {
            formatedSourcePathToDependencies.push({
                source: sourcePath,
                dependencies: sourcePathToDependencies[sourcePath]
            });
        }
    }
    return JSON.stringify(formatedSourcePathToDependencies, null, spaces) + "\n";
};

var readDependencyTree = function(formatedSourcePathToDependencies) {
    // Reads json constructed by createJSONStringFromTree and returns a sourcePathToDependencies
    var sourcePathToDependencies = {};
    formatedSourcePathToDependencies.forEach(function(dependencyData) {
        sourcePathToDependencies[dependencyData.source] = dependencyData.dependencies;
    });
    return sourcePathToDependencies;
};

var mergeObjects = function(defaultOptions,customOptions) {
    var merged = {};
    for (var attrname in defaultOptions) { merged[attrname] = defaultOptions[attrname]; }
    for (var attrname in customOptions) { merged[attrname] = customOptions[attrname]; }
    return merged;
}

exports.updateDependencies = function(customOptions, files, sourcePathToDependenciesPath ) {
    // var dest = options.dest || options.dependencyTree; // If destination is not set, rewrite the dependency file
    var defaultOptions = {
        pathPrefix: "."
    };
    var options = mergeObjects(defaultOptions, customOptions);
    var sourcePathToDependencies = readDependencyTree(JSON.parse(fs.readFileSync(options.dependencyTree, "utf8")));
    files.forEach(function(file) {
        processFile(file, options, sourcePathToDependencies);
    });
    return createJSONStringFromTree(sourcePathToDependencies);
};

exports.buildDependencies = function(customOptions) {
    // Merge task-specific and/or target-specific options with these defaults.
    var defaultOptions = {
        pathPrefix: ".",
        sourcePath: ".",
        format: "json",
    };
    var options = mergeObjects(defaultOptions, customOptions);
    var sourcePathToDependencies = {};

    fsutil.recurseDirSync(
        options.sourcePath,
        function(sourcePath) {
            processFile(sourcePath, options, sourcePathToDependencies);
        }
    );

    var dependencyFileContent = (options.format === "xml") ? createXMLStringFromTree(sourcePathToDependencies) : createJSONStringFromTree(sourcePathToDependencies);
    return dependencyFileContent;
};