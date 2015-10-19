$(function(){
	$('#training').on('click',function(){
		BC.api.call('create', {
			type: BC.GAME_TYPE.training
		},function(res){
			window.location = '/game?gameid='+res.gameid;
		});
		return false;
	});

	$('#single_player').on('click',function(){
		BC.api.call('create', {
			type: BC.GAME_TYPE.single_player
		},function(res){
			window.location = '/game?gameid='+res.gameid;
		});
		return false;
	});

	$('#token-ring').on('click',function(){
		$("#modal-token-ring").modal();
		return false;
	});

	$('#token-ring-create').on('click',function(){
		BC.api.call('create', {
			type: BC.GAME_TYPE.token_ring,
			name: $('#token-ring-name').val(),
			max_players: $('#token-ring-players').val()
		},function(res){
			window.location = '/game?gameid='+res.gameid;
		});
		return false;
	});

	$('#peer2peer').on('click',function(){
		$("#modal-peer2peer").modal();
		return false;
	});


	$('#peer2peer-create').on('click',function(){
		BC.api.call('create', {
			type: BC.GAME_TYPE.peer2peer,
			name: $('#peer2peer-name').val()
		},function(res){
			window.location = '/game?gameid='+res.gameid;
		});
		return false;
	});
})