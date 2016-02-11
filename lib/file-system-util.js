"use strict";

var fs = require("fs");
var path = require("path");

// Recurses a directory, returning all files
var recurseDirSync = function (fullPath, fileProcessor, directoryProcessor) {
    if (fileProcessor && fs.statSync(fullPath).isFile()) {
        fileProcessor(fullPath);
        return;
    } 

    if (directoryProcessor && !directoryProcessor(fullPath)) {
        // should not process dir
        return;
    }

    fs.readdirSync(fullPath).forEach(function (file) {
        var childPath = path.join(fullPath, file);
        recurseDirSync(childPath, fileProcessor, directoryProcessor);
    });
};
exports.recurseDirSync = recurseDirSync;

var ensureParentDirectoryExists = function (filePath) {

    var parentDir = path.dirname(filePath);
    if (parentDir == filePath) {
        return;
    }

    ensureParentDirectoryExists(parentDir);

    if (!fs.existsSync(parentDir)) {
        fs.mkdirSync(parentDir);
    }
};


// Copies a file synchronously, creating any necessary directories
exports.copySync = function (sourceFile, targetFile) {
    ensureParentDirectoryExists(targetFile);
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
};

// Convert windows separators to URL style
exports.ensureUrlSeparators = function (filePath) {
    var sep = path.sep;
    if (sep == "\\") {
        return filePath.replace(/\\/gi, "/");
    }

    return filePath;
};

exports.readFileSync = fs.readFileSync;

exports.writeFileSync = function (filePath, text, encoding) {
    ensureParentDirectoryExists(filePath);
    fs.writeFileSync(filePath, text, encoding);
};

exports.deleteSync = function (filePath, throwIfNotExists) {
    if (throwIfNotExists || fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

exports.existsSync = fs.existsSync;

exports.statSync = fs.statSync;