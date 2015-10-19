exports.run = function(host, port){
	var fs = require('fs');

	var express = require('express');
	var cookieParser = require('cookie-parser')
	var errors = require('./errors');
	var core = require('./core');

	var ai = require('./ai');
	var sockets = require('./sockets');
	var heartbeat = require('./heartbeat');

	var app = express();
	
	app.set('views', './views')
	app.set('view engine', 'jade');
	app.use('/static', express.static(__dirname + '/assets'));
	app.use(cookieParser());

	app.use(function(req,res,next){
		res.locals.training      = core.GAME_TYPE.training;
		res.locals.single_player = core.GAME_TYPE.single_player;
		res.locals.token_ring    = core.GAME_TYPE.token_ring;
		res.locals.peer2peer     = core.GAME_TYPE.peer2peer;

		res.locals.human         = core.PLAYER_TYPE.HUMAN;
		res.locals.pc            = core.PLAYER_TYPE.PC;


		res.locals.bull          = core.BULL;
		res.locals.cow           = core.COW;
		
		res.locals.apiurl        = 'http://'+host+':'+port+'/api/';

		res.locals.logourl       = 'http://'+host+':'+port+'/static/img/cow.png';
		res.locals.D  		 = (core.DEBUG) ? true : false;
		next();
	});

	// This is very important for API calls
	app.disable('etag')

	// Page routes
	app.get('/', function(req, res){
		var playerid = check_playerid(req,res);
		if(!playerid){return;}
		res.render('index', {
			scripts: ['/static/js/index.js']
		});		
	});
	app.get('/rules', function(req, res){
		res.render('rules', {});
	});
	app.get('/players', function(req, res){
		var playerid = check_playerid(req, res);
		if(!playerid){return;}

		var type = req.query.type || core.PLAYER_TYPE.HUMAN;
		var players = [];
		for(var k in core.players.data){
			if(type=='all' || core.players.data[k].type == type){
				players.push(core.players.data[k]);
			}
		}

		players.sort(function(a,b){
			return b.lastactive - a.lastactive;
		});

		res.render('players', {
			players: players,
			scripts: ['/static/js/reload.js']
		});
	});
	app.get('/games', function(req, res){
		var playerid = check_playerid(req, res);
		if(!playerid){return;}

		var games = [];
		var awaiting = req.query.awaiting || false;
		for(var k in core.games.data){
			if(awaiting){
				var game = core.games.data[k];
				var types = {};
				types[core.GAME_TYPE.token_ring] = 1;
				types[core.GAME_TYPE.peer2peer]  = 1;
				if(!game.started  && types[game.type] !== undefined){
					games.push(core.games.data[k]);
				}
			}else{
				games.push(core.games.data[k]);
			}
		}

		res.render('games', {
			games: games,
			scripts: ['/static/js/reload.js']
		});
	});
	app.get('/game', function(req, res){
		var playerid = check_playerid(req, res);
		if(!playerid){return;}
		var game     = core.games.get(req.query.gameid || '');
		if(!game){
			res.render('game_notfound', {});
			return;
		}
		res.render('game', {
			game: JSON.stringify(game.serialize(playerid)),
			scripts: [
				'/static/js/ext/handlebars-v4.0.2.js',
				'/static/js/ext/socket.io-1.2.0.js',
				'/static/js/game.js'
			]
		});
	});

	var check_playerid = function(req, res){
		var playerid = req.cookies.playerid || false;
		if(!core.players.get(playerid)){
			res.render('register', {scripts: ['/static/js/register.js']});
			return false;
		}
		return playerid;
	}

	// API routes
	app.get('/api/register', function(req, res){
		var name = req.query.name || '';
		if(!name){
			send_error(res, 1000);
			return;
		}

		var playerid = false;
		for(var k in core.players.data){
			var player = core.players.data[k];
			if(player.name == name && player.type == core.PLAYER_TYPE.HUMAN){
				playerid = k;
				break;
			}
		}

		if(!playerid){
			var player = core.players.create(core.PLAYER_TYPE.HUMAN);
			player.name = name;
			playerid = player.id;
			fs.appendFile('humans.csv', playerid + "," + name + "," + req.connection.remoteAddress + "\n" ,function (err) {});
		}

		send_resp(res, {
			result: 0,
			id: playerid
		});
	});

	app.get('/api/create', function(req, res){
		var player = core.players.get(req.query.playerid || ''); 
		if(!player){
			send_error(res, 2000);
			return;
		}

		var type = req.query.type || false;
		var types = {};
		types[core.GAME_TYPE.training] = 1;
		types[core.GAME_TYPE.single_player] = 1;
		types[core.GAME_TYPE.token_ring] = 1;
		types[core.GAME_TYPE.peer2peer] = 1;
		if(!types[type]){
			send_error(res, 1001);
			return;
		}

		var terminal = false;
		if(type != core.GAME_TYPE.peer2peer){
			terminal = ai.get_free_terminal();
		}

		var max_players = 2;
		if(type == core.GAME_TYPE.token_ring){
			max_players = req.query.max_players || 2;
			if(!(max_players > -1) || max_players < 3 || max_players > core.MAX_PLAYERS){
				send_error(res, 1002);
				return;
			}
		}

		var name = '';
		if(type == core.GAME_TYPE.training){
			name = 'Training ' + (++core.TRAININGS);
		}else if(type == core.GAME_TYPE.single_player){
			name = 'Single player ' + (++core.SINGLE_PLAYERS);
		}else{
			name = req.query.name || '';
			if(!name){
				send_error(res, 1000);
				return;
			}
		}

		var game = core.games.create(type, max_players, player, name);
		if(!game){
			send_error(res, 2001);
			return;
		}

		if(type == core.GAME_TYPE.training){
			game.register_player(terminal);
			game.register_player(player);
			game.set_opponent(player.id, terminal.id);
		}else if(type == core.GAME_TYPE.single_player){
			game.register_player(player);
			game.register_player(terminal);
			game.set_opponent(player.id, terminal.id);
			game.set_opponent(terminal.id, player.id);
		}else if(type == core.GAME_TYPE.token_ring){
			game.register_player(terminal);
			game.register_player(player);
			game.set_opponent(player.id, terminal.id);
		}else if(type == core.GAME_TYPE.peer2peer){
			game.register_player(player);
		}
		
		send_resp(res, {
			result: 0,
			gameid: game.id
		});		
	});
	
	app.get('/api/addterminal', function(req, res){
		var player = core.players.get(req.query.playerid || ''); 
		if(!player){
			send_error(res, 2000);
			return;
		}

		var gameid = req.query.gameid || false;
		if(!gameid){
			send_error(res, 1003);
			return;
		}

		var game = core.games.get(gameid);
		if(!game){
			send_error(res, 2002);
			return;
		}
		
		if(game.type != core.GAME_TYPE.token_ring){
			send_error(res, 2003);
			return;
		}

		var terminal = ai.get_free_terminal();
		if(!game.register_player(terminal)){
			send_error(res, 2004);
			return;	
		}

		game.set_opponent(terminal.id, game.players[0].id);

		game.notify_players('new_player', {player: terminal});
		
		send_resp(res, {result: 0});
	});

	app.get('/api/kick', function(req, res){
		var player = core.players.get(req.query.playerid || ''); 
		if(!player){
			send_error(res, 2000);
			return;
		}
		
		var gameid = req.query.gameid || false;
		if(!gameid){
			send_error(res, 1003);
			return;
		}

		var game = core.games.get(gameid);
		if(!game){
			send_error(res, 2002);
			return;
		}

		var kicked = req.query.kicked || player.id;
		if(!game.can_unregister_player(kicked, player.id)){
			send_error(res, 3001);
			return;
		}

		if(!game.unregister_player(core.players.get(kicked))){
			send_error(res, 3001);
			return;
		}
		
		send_resp(res, {result: 0});
	});

	app.get('/api/start', function(req, res){
		var player = core.players.get(req.query.playerid || ''); 
		if(!player){
			send_error(res, 2000);
			return;
		}
		var gameid = req.query.gameid || false;
		if(!gameid){
			send_error(res, 1003);
			return;
		}

		var game = core.games.get(gameid);
		if(!game){
			send_error(res, 2002);
			return;
		}

		if(!game.can_start(player.id)){
			send_error(res, 3000);
			return;
		}

		if(game.type == core.GAME_TYPE.peer2peer){
			if(game.players.length < 2){
				send_error(res, 3002);
				return;	
			}
		}

		if(!game.start(player)){
			send_error(3000);
			return;
		}

		send_resp(res, {result: 0});
	});

	var send_resp = function(res, data){
		res.setHeader('Content-Type', 'application/json');
    	res.send(JSON.stringify(data));	
	}
	var send_error = function(res, code){
		send_resp(res, 
						{
							result: code, 
							message: errors.codes[code] || 'Unknown' 
						});
	}

	
	

	heartbeat.start(function(){
		var server = require('http').createServer(app);
		var io = require('socket.io')(server);
		
		io.on('connection', function(socket){
			sockets.bind_socket(socket);
		});	

		server.listen(port, function(){
			host = host || server.address().address;
			port = port || server.address().port;
			console.log("Game server listening on http://%s:%s",host,port);
		});
	});
}