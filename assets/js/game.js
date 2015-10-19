var BC = BC || {};

BC.player_names = {};
BC.cansubmit = false;

BC.get_game_header = function(){
	var context = {
		type: BC.type_names[BC.game.type],
		players: BC.game.players.length,
		max_players: BC.game.max_players
	};

	var html = BC.game_header_template(context);
	$('.game-header').html(html);
}

BC.add_player_item = function(player){
	var context = {
		name: player.name,
		type: BC.player_type_names[player.type],
		kick: ''
	};
	if(player.can_kick){
		context.kick = '<a rel="'+player.id+'" href="#">kick</a>';
	}
	var html = $(BC.game_player_item(context));
	$(html).attr('rel', player.id);
	$(html).find('a').on('click', function(){
		var args = 	{
						gameid: BC.game.id,
						kicked: player.id
					};
		BC.api.call('kick', args, function(){});
	});
	$('#player-list').append(html);
}

BC.remove_player_item = function(playerid){
	$("#player-list li[rel='"+playerid+"']").remove();
}

BC.set_current_player = function(){
	$("#player-list li").removeClass('active');
	$("#player-list li[rel='"+BC.game.current+"']").addClass('active');
	$('#player-number').val('');

	if(BC.game.myturn){
		BC.cansubmit = true;
		$('#player-number').removeAttr('disabled');
		$('input[autofocus]').focus();
	}else{
		BC.cansubmit = false;
		$('#player-number').attr('disabled', 1);
	}
}

BC.show_number=function(){
	$('#player-secret').text(BC.game.number);
};

BC.submit_number = function(){
	if(!BC.cansubmit){return;}
	var guess = $('#player-number').val();
	BC.socket.emit_event('guess', {number: guess});
};


BC.get_score_view = function(score){
	var result = '';
	for(var i = 0; i < score[BC.BULL]; i++){
		result += '<span class="score bull" title="Bull"></span>';
	}
	for(var i = 0; i < score[BC.COW]; i++){
		result += '<span class="score cow" title="Cow"></span>';
	}
	for(var i = 0; i < 4 - (score[BC.COW] + score[BC.BULL]); i++ ){
		result += '<span class="score" title="NO"></span>';
	}
	return '<div class="score-placeholder">' + result + '</div>';
}


BC.add_move=function(move){
	if(move.mine){
		var context = {
			name: move.number,
			kick: BC.get_score_view(move.result)
		};
		$('#your-moves-list').prepend(
			BC.game_player_item(context)
		);
	}else{
		var context = {
			name: BC.player_names[move.playerid],
			kick: BC.get_score_view(move.result)
		};
		if(move.number){
			context.name += ' - ' + move.number;
		}
		$('#others-moves-list').prepend(
			BC.game_player_item(context)
		);
	}
}

BC.turn_progress = {
	init: function(){
		var interval = setInterval(function(){
			if(BC.game.guessing.start == 0){return;}
			var duration = BC.game.guessing.end - BC.game.guessing.start;
			var current  = BC.game.guessing.end - (new Date().getTime() / 1000);
			var value    = (current / duration) * 100;
			if(value < 0){return;}


			var progress = $('#game-turn');
			progress.css({width: value + '%'});

			progress.removeClass('progress-bar-success');
			progress.removeClass('progress-bar-warning');
			progress.removeClass('progress-bar-danger');

			if(BC.game.myturn){
				if(value <= 20){
					progress.addClass('progress-bar-danger');
				}else if(value <= 40){
					progress.addClass('progress-bar-warning');
				}else{
					progress.addClass('progress-bar-success');
				}
			}

		}, 1000);
	}
};


BC.build_game=function(){
	if(BC.game.started){
		// Here is the might of magic - on the battlefield :)
			
		var html = BC.battlefiled_template({name: BC.game.name});
		$('#game').html(html);
		BC.get_game_header();
		BC.show_number();
		for(var k in BC.game.players){
			BC.game.players[k].can_kick = false;
			BC.add_player_item(BC.game.players[k]);
			BC.player_names[BC.game.players[k].id] = BC.game.players[k].name;
		}
		BC.set_current_player();

		for(var k in BC.game.moves){
			BC.add_move(BC.game.moves[k]);
		}

		$('#player-number-submit').on('click', function(){
			BC.submit_number();
		});
		$('#player-number').on('keypress', function(e){
			if(e.which == 13){BC.submit_number();}
		});
	}else{
		// Here is the waiting room

		var html = BC.players_template({name: BC.game.name});
		$('#game').html(html);
		BC.get_game_header();
		for(var k in BC.game.players){
			BC.add_player_item(BC.game.players[k]);
			BC.player_names[BC.game.players[k].id] = BC.game.players[k].name;
		}

		var cancel = $('<button class="btn btn-danger">Leave</button>');
		cancel.on('click', function(){
			var args = {gameid: BC.game.id};
			BC.api.call('kick', args, function(){});
		});
		$('#players-button-left').append(cancel);

		if(BC.game.can_add_terminal){
			var addterminal = $('<button class="btn btn-info">Add terminal</button>');
			addterminal.on('click', function(){
				var args = {gameid: BC.game.id};
				BC.api.call('addterminal', args, function(){});
			});
			$('#players-button-left').append(addterminal);
		}

		if(BC.game.can_start){
			var start = $('<button class="btn btn-success">Start</button>');
			start.on('click', function(){
				var args = {gameid: BC.game.id};
				BC.api.call('start', args, function(){});
			});
			$('#players-button-right').append(start);
		}
	}
};

BC.bind_socket = function(){

	// io.connect('http://localhost:8000');
	var socket = io();
	socket.bind_event = function(eventName, callback, error){
		socket.on(eventName, function(resp){		
			resp = JSON.parse(resp);
			if(BC.DEBUG){
				console.log('Receive: ' + eventName, resp);	
			}
			if(resp.result){
				if(error){error(resp)}
				else{alert(resp.message);}
			}else{
				callback(resp);
			}
		});
	}
	socket.emit_event = function(eventName, args){
		args.playerid = BC.playerid || '';
		if(BC.DEBUG){
			console.log('Emit: ' + eventName, args);	
		}
		socket.emit(eventName,JSON.stringify(args));
	}

	socket.on('connection', function(socket){});
	socket.bind_event('join', function(resp){}, function(err){
		alert(err.message);
		window.location = '/';
	});
	socket.emit_event('join', {gameid: BC.game.id});

	socket.bind_event('new_player', function(args){	
		for(var k in BC.game.players){
			if(BC.game.players[k].id == args.player.id){
				return;
			}
		}
		BC.player_names[args.player.id] = args.player.name;
		BC.game.players.push(args.player);
		BC.get_game_header();
		BC.add_player_item(args.player);
	});

	socket.bind_event('leave_player', function(args){
		if(args.player.id == BC.playerid){
			window.location = '/';
			return;
		}
		
		for(var k in BC.game.players){
			if(BC.game.players[k].id == args.player.id){
				BC.game.players.splice(k, 1);
				break;
			}
		}
		delete BC.player_names[args.player.id];
		BC.get_game_header();
		BC.remove_player_item(args.player.id);
	});

	socket.bind_event('start', function(args){
		BC.game.started = true;
		BC.build_game();
	});

	socket.bind_event('guess', function(args){
		BC.add_move(args.guess);
	});

	socket.bind_event('turn', function(args){
		socket.emit_event('acknowledge', {});
		BC.game.myturn  = args.mine;
		BC.game.current = args.player.id;
		BC.set_current_player();

		BC.game.guessing.start = args.guessing.start;
		BC.game.guessing.end   = args.guessing.end;
	});

	socket.bind_event('set_number', function(args){
		BC.game.number = args.number;
		BC.show_number();
	});

	socket.bind_event('win', function(args){
		if(args.mine){
			BC.message = 'Congratulations! You won this game!';
		}else{
			BC.message = 'You lost this game!';
			if(args.number){
				BC.message += "\nYour opponent's number was: " + args.number
			}
		}
	});

	socket.bind_event('invalid_guess', function(args){
		BC.invalidte_input('#player-number');
	});
	
	socket.bind_event('timeout', function(args){
		BC.message = "Timeout was detected.";
	});

	socket.bind_event('terminate', function(args){
		if(!BC.message){
			BC.message = "The game was terminated.";
		}
	});

    socket.on('disconnect', function () {
    	if(!BC.message){
			BC.message = "Connection lost.";
		}
		alert(BC.message);
        setTimeout( function(){
        	window.location = '/';
        }, 3000); 
    });


	socket.bind_event('timeout', function(args){
		BC.message = "Timeout was detected.";
	});


  	$(window).on('beforeunload', function(){
	    socket.close();
	});

	BC.socket = socket;
};

$(function(){
	BC.type_names = {};
	BC.type_names[BC.GAME_TYPE.training] = 'Training';
	BC.type_names[BC.GAME_TYPE.single_player] = 'Single player';
	BC.type_names[BC.GAME_TYPE.token_ring] = 'Token ring';
	BC.type_names[BC.GAME_TYPE.peer2peer] = 'peer2peer';

	BC.player_type_names = {};
	BC.player_type_names[BC.PLAYER_TYPE.human] = 'Human';
	BC.player_type_names[BC.PLAYER_TYPE.pc] = 'PC';

	var decoded = $("<div/>").html(game).text();
	BC.game = JSON.parse(decoded);

	BC.players_template = Handlebars.compile($("#players-template").html());
	BC.game_header_template = Handlebars.compile($("#game-header-template").html());
	BC.game_player_item = Handlebars.compile($("#game-player-item-template").html());
	BC.battlefiled_template = Handlebars.compile($("#battlefield-template").html());


	BC.build_game();
	BC.turn_progress.init();
	BC.bind_socket();
});