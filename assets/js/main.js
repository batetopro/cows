var BC = BC || {};

BC.api = {
	url: 'http://localhost:3000/api/',
	call: BC.call = function(method, args, callback, error){
		args.playerid = BC.playerid || '';
		$.getJSON(BC.api.url + method, args, function(res){
			if(res.result){
				if(error){
					error(res);
				}else{
					alert(res.message);
				}
			}else{
				callback(res);
			}
		});
	}
};

BC.parse_query=function(qstr){
	var query = {};
    if(!qstr){return query;}
    var a = qstr.substr(1).split('&');
    for (var i = 0; i < a.length; i++) {
        var b = a[i].split('=');
        query[decodeURIComponent(b[0])] = decodeURIComponent(b[1] || '');
    }
    return query;
}

BC.playerid = false;
BC.query    = {};
BC.init = function(){
	BC.playerid = $.cookie('playerid');
	BC.query    = BC.parse_query(window.location.search);
}

$(function(){
	BC.init();
});


BC.last_invalid = {};
BC.invalidte_input = function(id){
	var ts = new Date().getTime();
	if(BC.last_invalid[id] === undefined){
		BC.last_invalid[id] = ts;
	}else if(ts > BC.last_invalid[id]){
		BC.last_invalid[id] = ts;
	}
	$(id).parent().addClass('has-error');
	setTimeout(function(){
		if(BC.last_invalid[id] == ts){
			$(id).parent().removeClass('has-error');
		}
	}, 1000);
}
