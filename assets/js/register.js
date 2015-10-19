$(function(){
	var register = function(){
		BC.api.call('register', {
			name: $('#register-name').val()
		}, function(res){
			$.cookie('playerid', res.id);
			location.reload(); 
		}, function(){
			BC.invalidte_input('#register-name');
		});
	};
	$('#register-name').on('keypress', function(e){
		if(e.which == 13){register();}
	});
	$('#register-go').on('click', function(){
		register();
	});
});