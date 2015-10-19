var core = require('./core');
var errors = require('./errors');

var get_sockets = function(){
	var sockets = {
		conns: {},
		playerids: {},
		add: function(socketid, socket){
			sockets.conns[socketid] = {
				socket: socket,
				playerid: undefined
			};
			socket.send_resp = function(eventName, resp){
				if(core.DEBUG){
					console.log('Socket send: ', eventName, JSON.stringify(resp));	
				}
				socket.emit(eventName, JSON.stringify(resp));
			}
			socket.send_error=function(eventName, code){
				socket.send_resp(eventName, {
												result: code, 
												message: errors.codes[code] || 'Unknown' 
											});
			}
			socket.bind_event=function(eventName, callback){
				socket.on(eventName, function(msg){
					if(core.DEBUG){
						console.log('Socket receive: ', eventName);	
					}
					var args;
					try{
						args = JSON.parse(msg);
					}catch(e){
						socket.send_error(eventName,4000);
						return;
					}

					var player = core.players.get(args.playerid||'');
					if(!player){
						socket.send_error(eventName,2000);
						return;
					}

					// do not ask me, what else will happen :)
					if(player.type == core.PLAYER_TYPE.PC){
						socket.send_error(eventName,4000);
						return;
					}

					callback(args, player);
				});
			}
		},
		set_player: function(socketid, playerid){
			if(sockets.conns[socketid].playerid !== undefined){return false;}
			sockets.conns[socketid].playerid = playerid;
			sockets.playerids[playerid] = socketid;
			return true;
		},
		remove: function(socketid){
			if(sockets.conns[socketid] === undefined){return;}
			var playerid = false;
			for(var pid in sockets.playerids){
				if(sockets.conns[socketid].playerid == playerid){
					playerid = pid;
					break;
				}
			}
			if(playerid){
				delete sockets.playerids[playerid];	
			}
			delete sockets.conns[socketid];
		},
		get: function(socketid){
			if(sockets.conns[socketid] == undefined){return false;}
			return sockets.conns[socketid].socket;
		},
		get_for_player: function(playerid){
			var socketid = sockets.playerids[playerid];
			if(socketid === undefined){return false;}
			return sockets.get(socketid);
		}
	};
	return sockets;
}

exports.sockets = get_sockets();

exports.bind_socket = function(socket){

	var address = socket.client.conn.remoteAddress;
	console.log('a user connected: ' + address + ' (' + socket.id + ')');
	exports.sockets.add(socket.id, socket);

	socket.on('disconnect', function(){
		console.log('user disconnected:  ' + address + ' (' + socket.id + ')');
		var playerid = exports.sockets.conns[socket.id].playerid;
		exports.sockets.remove(socket.id);
		if(playerid){
			var player = core.players.get(playerid);
			if(!player){return;}
			var game = core.games.get(player.gameid);
			if(!game){return;}
			setTimeout(function(){
				var check = exports.sockets.get_for_player( playerid );
				if(check){return;}
				game.started = false;
				game.unregister_player(player);
			}, core.TIMEOUT.SOCKET * 1000);
		}
	});

	socket.bind_event('join', function(args, player){
		var game = core.games.get(args.gameid || false);
		if(!game){
			socket.send_error('join', 2002);
			return;
		}
		if(!game.register_player(player)){
			socket.send_error('join', 3003);
			return;
		}
		if(!exports.sockets.set_player(socket.id, player.id)){
			socket.send_error('join',4000);
			return;
		}

		player.lastactive = game.time();

		player.on('new_player',function(args){
			socket.send_resp('new_player', {
				result: 0,
				player: game.filter_player(args.player, player.id)
			});
		});

		player.on('leave_player', function(args){
			socket.send_resp('leave_player', {
				result: 0,
				player: game.filter_player(args.player, player.id)
			});
		});
		
		player.on('start', function(args){
			socket.send_resp('start', {result: 0});
		});

		player.on('guess', function(args){
			socket.send_resp('guess', {result: 0, guess: game.filter_move(args, player.id)});
		});

		player.on('turn', function(args){
			socket.send_resp('turn', {
				result:0,
				player: game.filter_player(args.player, player.id),
				mine:   player.id == args.player.id,
				guessing: {
					start: args.guessing.start,
					end: args.guessing.end
				}
			});
		});

		player.on('timeout', function(args){
			socket.send_resp('timeout', {result: 0});
		});

		player.on('terminate', function(args){
			socket.send_resp('terminate', {result: 0});
			socket.disconnect(true);
		});

		player.on('win', function(args){
			var resp = {result: 0, mine: args.playerid == player.id};
			if(!resp.mine && game.opponents[player.id] !== undefined){
				resp.number = game.players[game.opponents[player.id]].number;
			}
			socket.send_resp('win', resp);
		});

		player.on('set_number', function(args){
			socket.send_resp('set_number', {result: 0, number: args.number});
		});

		player.on('invalid_guess', function(args){
			socket.send_resp('invalid_guess', {result: 0});
		});

		// Player was bound
		if(game.started){return;}

		if(game.type == core.GAME_TYPE.peer2peer){
			if(player.id != game.ownerid){
				game.set_opponent(player.id, game.ownerid);
				game.set_opponent(game.ownerid, player.id);
			}
		}else if(game.type == core.GAME_TYPE.token_ring){
			game.set_opponent(player.id, game.players[0].id);
		}else if(game.type == core.GAME_TYPE.single_player){
			game.set_opponent(game.players[1].id, player.id);
			game.set_opponent(player.id, game.players[1].id);
			game.start(player);
		}else if(game.type == core.GAME_TYPE.training){
			game.set_opponent(player.id, game.players[0].id);
			game.start(player);
		}else{
			// this is invalid :)
		}

		game.notify_players('new_player', {player: player});
	});

	socket.bind_event('acknowledge', function(args, player){
		player.send_command('acknowledge', {});
	});

	socket.bind_event('guess', function(args, player){
		var number = args.number || '';
		if(!number){
			socket.send_error('invalid_guess', 1004);
			return;
		}
		player.send_command('guess', {guess: number});
	});
}