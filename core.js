var crypto = require('crypto');

exports.COW  = 1;
exports.BULL = 2;
exports.LEN  = 4;
exports.MAX_PLAYERS = 8;


exports.DEBUG = false;

exports.TRAININGS = 0;
exports.SINGLE_PLAYERS = 0;

exports.PLAYER_TYPE = {
	PC: 0,
	HUMAN: 1
};

exports.GAME_TYPE = {
	training:      0,
	single_player: 1,
	token_ring:    2,
	peer2peer:     3
};

exports.TIMEOUT = {
	ACK: 2,
	TURN: 120,
	SOCKET: 30
};

var get_registry = function(){
	var registry = {
		data: {},
		get_id: function(){
			var shasum = crypto.createHash('sha1');
			shasum.update(Math.random().toString());
			shasum.update(Math.random().toString());
			var id = shasum.digest('hex');
			if(registry.data[id]){
				return registry.get_id();
			}
			return id;
		},
		add: function(entry){
			var id = registry.get_id();
			registry.data[id] = entry;
			return id;
		},
		get: function(id){
			return registry.data[id] || false;
		},
		set: function(id, entry){
			registry.data[id] = entry;
		},
		remove: function(id){
			if(registry.data[id]){
				delete registry.data[id];
			}
		}
	};
	return registry;
}

exports.games = get_registry();
exports.games.create = function(type, max_players, owner, name){
	if(owner.gameid){return false;}

	var game = {
		ownerid:     owner.id,
		max_players: max_players,
		type: type,
		name: name,
		
		started: false,
		players: [],
		playerids: {},
		opponents: {},


		current:  false,
		interval: false,
		guessing: 0,
		acknowledges: false,

		moves: [],
		queue: [],

		time: function(){
			return Math.floor(Date.now() / 1000);
		},
		set_acknowledges: function(){
			game.acknowledges = {
				until: game.time() + exports.TIMEOUT.TURN,
				count: 0,
				ids: []
			};
		},
		next_player: function(){
			while(1){
				if(game.current === false){
					game.current = 0;
				}else{
					game.current = (game.current + 1) % game.players.length;	
				}
				var playerid = game.players[game.current].id;
				if(game.opponents[playerid] !== undefined){
					break;
				}
			}
		},
		start: function(initiatior){
			if(game.started){return;}
			if(game.ownerid != initiatior.id){return false;}
			if(!game.notify_players('should_start',{})){return false;}
			game.started = true;

			game.notify_players('start', {});

			game.next_player();
			
			var ts = game.time();
			game.notify_players('turn', {
				player: game.players[game.current],
				guessing: {
					start: ts,
					end: ts + exports.TIMEOUT.TURN
				}
			});
			
			game.set_acknowledges();
			game.interval = setInterval(function(){
				var ts = game.time();
				var lastidx = 0;
				if(game.queue.length > 0){
					lastidx = game.queue.length;
				}

				if(game.guessing){
					if(ts > game.guessing){
						game.timeout();
						return;
					}

					var playerid = game.players[game.current].id;
					for(var i = game.queue.length - 1; i >= 0;i--){
						var cmd = game.queue[i];
						if(cmd[0] == 'guess' && cmd[1].playerid == playerid){
							var move = {
								playerid: cmd[1].playerid,
								guess: cmd[1].guess
							};

							if(!exports.validate_query(cmd[1].guess)){
								game.players[game.current].notify('invalid_guess', move);
							}else{
								
								// who I fight against :)
								
								var other = game.players[game.opponents[playerid]].number;
								var check = exports.diff_numbers(other, cmd[1].guess);
								
								move.result = check;
								game.moves.push(move);
								game.notify_players('guess', move);
								
								if(check[exports.BULL] == exports.LEN){
									game.notify_players('win', {playerid: playerid});
									game.terminate();
									break;
								}
								
								game.next_player();
								game.notify_players('turn', {
									player: game.players[game.current],
									guessing: {
										start: ts,
										end: ts + exports.TIMEOUT.TURN
									}
								});
								
								game.set_acknowledges();
								game.guessing = 0;
							}
							break;
						}
					}
				}else{
					if(ts > game.acknowledges.until){
						game.timeout();
						return;
					}
					for(var k in game.queue){
						var cmd = game.queue[k];
						if(cmd[0] == 'acknowledge'){
							if(game.acknowledges.ids[cmd[1]]){continue;}
							game.acknowledges.ids[cmd[1].playerid] = 1;
							game.acknowledges.count ++;
							if(game.acknowledges.count == game.players.length){
								game.guessing = ts + exports.TIMEOUT.TURN;
							}
						}else if(cmd[0] == 'guess'){
							var move = {
								playerid: cmd[1].playerid,
								guess: cmd[1].guess
							};
							game.players[game.playerids[cmd[1].playerid]].notify('invalid_guess', move);
						}
					}
				}

				game.queue.splice(0, lastidx);
				
			}, 50);

			return true;
		},
		notify_players: function(eventName, args){
			var result = true;

			for(var k in game.players){
				var check = game.players[k].notify(eventName, args);
				if(check !== undefined){
					result &= check;
				}
			}
			return result;
		},
		receive_command: function(command, args){
			if(!game.started){return false;}
			game.queue.push([command, args]);
			return true;
		},
		timeout: function(){
			game.notify_players('timeout',{});
			game.terminate();
		},
		terminate: function(){
			game.started = false;
			for(var k in game.players){
				game.players[k].gameid = '';
				game.players[k].number = '';
			}
			clearInterval(game.interval);
			game.notify_players('terminate',{});
			exports.games.remove(game.id);
		},
		serialize: function(viewerid){
			var serialized = {
				id: game.id,
				name: game.name,
				ownerid: game.ownerid,
				max_players: game.max_players,
				type: game.type,
				started: game.started,
				players: [],
				moves: [],
				can_start: game.can_start(viewerid),
				can_add_terminal: game.can_add_terminal(viewerid),
				myturn: false,
				number: '',
				guessing: {
					start: game.guessing - exports.TIMEOUT.TURN,
					end: game.guessing
				}
			};

			var viewer = exports.players.get(viewerid);
			if(viewer){
				serialized.number = viewer.number;
			}

			if(game.started){
				serialized.myturn = game.players[game.current].id == viewerid;
				serialized.current = game.players[game.current].id;	
			}

			for(var k in game.players){
				serialized.players.push(game.filter_player(game.players[k], viewerid));
			}

			for(var k in game.moves){
				serialized.moves.push(game.filter_move(game.moves[k], viewerid));
			}

			return serialized;
		},
		filter_move: function(move, viewerid){
			var result = {
				result: move.result,
				playerid: move.playerid,
				mine: move.playerid == viewerid
			};

			var show = (move.playerid == viewerid);
			if(!show){
				show = game.opponents[move.playerid] === game.playerids[viewerid];
			}

			if(show){
				result.number = move.guess;
			}
			return result;
		},
		filter_player: function(player, viewerid){
			var result = {
				id:   player.id,
				name: player.name,
				type: player.type,
				can_kick: game.can_unregister_player(player.id, viewerid)
			};
			if(player.	id == viewerid){
				result.number = player.number;
			}
			return result;
		},
		can_add_terminal: function(viewerid){
			if(game.started){return false;}
			if(game.ownerid != viewerid){return false;}
			if(game.type != exports.GAME_TYPE.token_ring){return false;}
			if(game.players.length >= game.max_players){return false;}
			return true;
		},
		can_start: function(viewerid){
			if(game.started){return false;}
			return viewerid == game.ownerid;
		},
		register_player: function(player){
			if(game.playerids[player.id] !== undefined){return true;}

			if(player.gameid){return false;}
			if(game.started){return false;}
			if(game.players.length >= game.max_players){return false;}
			
			player.gameid = game.id;
			player.number = '';

			game.playerids[player.id] = game.players.length;
			game.players.push(player);
			
			return true;
		},
		set_opponent: function(playerid, opponentid){
			if(game.playerids[playerid]   === undefined){return false;}
			if(game.playerids[opponentid] === undefined){return false;}

			game.opponents[playerid] = game.playerids[opponentid];

			var opponent = game.players[game.playerids[opponentid]];
			if(!opponent.number){
				opponent.number = exports.generate_number();
				opponent.notify('set_number', { number: opponent.number });
			}
			
			return true;
		},
		can_unregister_player: function(playerid, viewerid){
			if(game.started){return false;}
			if(playerid == viewerid){return true;}
			if(game.ownerid != viewerid){return false;}

			if(game.type == exports.GAME_TYPE.single_player){return false;}
			if(game.opponents[playerid] === undefined){return false;}
			
			return true;
		},
		unregister_player: function(player){
			if(game.started){return false;}
			if(game.playerids[player.id] === undefined){return false;}
			player.gameid = '';
			player.number = '';
			if(player.id == game.ownerid){
				game.terminate();
			}else{
				game.notify_players('leave_player', {player: player});
				delete game.opponents[player.id];
				game.players.splice(game.playerids[player.id], 1);
				delete game.playerids[player.id];
			}
			return true;
		}
	};
	game.id = exports.games.add(game);
	return game;
}

exports.players = get_registry();
exports.players.create = function(type){
	var player = {
		name: '',
		number: '',
		gameid: '',
		type: type,
		lastactive: 0,
		events: {
			new_player: function(args){},
			leave_player: function(args){},
			should_start: function(args){},
			start: function(args){},
			guess: function(args){},
			turn:  function(args){},
			timeout: function(args){},
			win:   function(args){},
			set_number: function(args){},
			invalid_guess: function(args){},
			terminate: function(args){}
		},
		send_command: function(command, args){
			args.playerid = player.id;
			var game = exports.games.get(player.gameid);
			game.receive_command(command, args);
		},
		on: function(eventName, callback){
			player.events[eventName] = callback;
		},
		notify: function(eventName, args){
			if(player.events[eventName]){
				return player.events[eventName](args);
			}
		}
	};
	player.id = exports.players.add(player);
	return player;
}

exports.validate_query = function(query){
	if(!query){return false;}
	query = query.toString();
	if(query.length != exports.LEN){return false;}
	if(query[0] == '0'){return false;}
	
	var check = {};
	for(var i = 0;i<query.length;i++){
		if(!(query[i] > -1)){return false;}
		if(check[query[i]]){return false;}
		check[query[i]] = 1;
	}
	return true;
}

function getRandomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

exports.shuffle_array = function(array){
	// Algorithm: https://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
	var n = array.length;
	for(var i = 0; i < n - 1; i++){
		var j = getRandomInt(i, n - 1);
		var t = array[i];
		array[i] = array[j];
		array[j] = t;
	}
	return array;
}

exports.generate_number = function(){
	var numbers = ['0','1','2','3','4','5','6','7','8','9'];
	numbers = exports.shuffle_array(numbers);
	if(numbers[0] == '0'){return exports.generate_number();}
	return numbers.join('').substring(0,exports.LEN);
}

exports.diff_numbers = function(first, second){
	var result = {};
	result[exports.BULL] = 0;
	result[exports.COW] = 0;

	var map = {};
	for(var i = 0; i < first.length;i++){
		map[first[i]] = i;
	}

	for(var i = 0; i < second.length; i++){
		var pos = map[second[i]];
		if(pos !== undefined){
			if(pos == i){
				result[exports.BULL]++;
			}else{
				result[exports.COW]++;
			}
		}
	}

	return result;
}