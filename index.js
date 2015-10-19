#!/usr/bin/env node

var path = require('path');
var core = require('./core');

//var express = require('express');
var pkg = require( path.join(__dirname, 'package.json') );

// Parse command line options
var program = require('commander');
program
	.version(pkg.version)
	.option('-m, --mode <mode>', "Mode of the game. [c]onsole or [w]eb.")
	.option('-p, --port <port>', 'Port on which to listen to (defaults to 3000).', parseInt)
	.option('-h, --host <host>', 'IP address or domain of the machine (defaults to 0.0.0.0).')
	.option('-d, --debug <debug>', 'Should show the socket communication.')
	.parse(process.argv);

core.DEBUG = program.debug || false;
var mode = program.mode || 'web';
if(mode == 'console' || mode == 'c'){
	var game = require('./console');
	game.run();
}else if(mode == 'web' || mode == 'w'){
	var port = program.port || 3000;
	var host = program.host || false;
	var game = require('./http');
	game.run(host, port);
}else{
	console.log("Invalid use.");
	process.exit();
}