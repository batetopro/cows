var core = require('./core');
var TERMINALS = 0;

exports.get_free_terminal = function(){
	var terminal = false;
	for(var k in core.players.data){
		var player = core.players.data[k];
		if(player.type != core.PLAYER_TYPE.PC){continue;}
		if(!player.gameid){
			terminal = player;
			break;
		}
	}
	if(!terminal){
		terminal = core.players.create(core.PLAYER_TYPE.PC);
		terminal.name = 'Terminal ' + (++TERMINALS);
		terminal.on('start', function(args){
			var game = core.games.get(terminal.gameid);
			if(game.opponents[terminal.id] === undefined){
				return;
			}
			terminal.moves = [];
			for(var i=1000;i<10000;i++){
				i = i.toString();
				if(core.validate_query(i)){
					terminal.moves.push(i);
				}
			}
		});
		
		terminal.on('turn', function(args){
			terminal.send_command('acknowledge', {});
			if(args.player.id != terminal.id){return;}
			terminal.moves = core.shuffle_array(terminal.moves);
			terminal.send_command('guess', {guess: terminal.moves[0]});
		});


		terminal.on('invalid_guess', function(args){
			if(args.playerid != terminal.id){return;}
			terminal.send_command('guess', {guess: args.guess});
		});

		terminal.on('guess', function(args){
			if(args.playerid != terminal.id){return;}
			var filtered = [];
			for (var k in terminal.moves){
				var check = core.diff_numbers(args.guess, terminal.moves[k]);
				if(check[core.COW] == args.result[core.COW] && check[core.BULL] == args.result[core.BULL]){
					filtered.push(terminal.moves[k]);
				}
			}
			terminal.moves = filtered;
		});
	}
	
	return terminal;
}