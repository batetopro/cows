var core = require('./core');
var readline = require('readline');
var fs = require('fs');
var sockets = require('./sockets');

var INTERVAL = 500;
var KILL_INTERVAL = 100;
exports.start = function(callback){
	var ctr = 0;
	var rl = readline.createInterface({
	      input : fs.createReadStream('humans.csv'),
	      output: process.stdout,
	      terminal: false
	});
	rl.on('line',function(line){
		var parts = line.split(',');
		if(core.players.data[parts[0]]){return;}
		
		var skip = 0;
		for(var k in core.players.data){
			if(core.players.data[k].name == parts[1]){
				skip = 1;
				break;
			}
		}
		if(skip){return;}


		var player = core.players.create(core.PLAYER_TYPE.HUMAN);
		core.players.remove(player.id);
		player.id   = parts[0];
		player.name = parts[1];
		player.lastactive = (++ctr);
		core.players.set(parts[0], player);
	});
	rl.on('close', function(){
		callback();
	});

	process.on('SIGINT', function() {stop(); process.exit();});
	process.on('exit', function() {stop();});
};
var stop = function(){
	for(var k in core.games.data){
		core.games.data[k].terminate();
	}
};	