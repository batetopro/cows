var core = require('./core');

exports.run = function(){
	console.log("Welcome to cows and bulls :)");

	var terminal     = core.players.create(core.PLAYER_TYPE.PC);
	terminal.name    = 'Der Terminal';
	terminal.on('turn', function(){
		terminal.send_command('acknowledge', {});
	});
	terminal.on('timeout', function(args){
		console.log('Timeout detected.');
	});
	terminal.on('terminate', function(args){
		process.exit();
	});
	terminal.on('set_number', function(args){
		//console.log(args);
	});
	
	var player       = core.players.create(core.PLAYER_TYPE.HUMAN);
	player.number    = '';
	player.name      = 'Der Spieler';

	player.on('start', function(args){
		process.stdout.write("Game started!\nGuess the number of the terminal.\n");
	});

	player.on('turn', function(){
		player.send_command('acknowledge', {});
		process.stdout.write("Guess: ");
	});
	
	player.on('invalid_guess', function(){
		process.stdout.write("Invalid Move!\n");
		process.stdout.write("Guess: ");
	});
	
	player.on('win', function(){
		process.stdout.write("You guessed the number!\n");
	})

	player.on('guess', function(args){
		process.stdout.write("Hits: C="+args.result[core.COW]+" B="+args.result[core.BULL]+" \n");
	});

	var game = core.games.create(core.GAME_TYPE.training, 2, player, "Console training");
	game.register_player(terminal);
	game.register_player(player);
	game.set_opponent(player.id, terminal.id);
	
	console.log("Are you ready to start ???");
	console.log("[press any key]");

	var buffer  = '';
	process.stdin.setRawMode(true);
	process.stdin.resume();
	process.stdin.on('data', function (chunk) {
		var text = chunk.toString('utf8');
		
		// ctrl + c
		if (text === '\u0003' ){game.terminate(true);}
		if (!game.started){
			game.start(player); 
			return;
		}

		// enter
		if (text === '\u000D'){ 
			process.stdout.write("\n");
			player.send_command('guess', {guess: buffer});
			buffer = '';
			return;
		}

		// backspace
		if (text === '\u007F'){ 
			buffer = buffer.substring(0,buffer.length-1);
		}		

		// is number
		if(text > -1){
			buffer = buffer + text;
		}

		process.stdout.clearLine();
		process.stdout.cursorTo(0);
		process.stdout.write("Guess: " + buffer);
	});
}