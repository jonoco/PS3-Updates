module.exports = {
	requireAuthentication: function( req, res, next ) {
		console.log('private route!')
		next();
	},
	logger: function( req, res, next ) {
		var timestamp = new Date().toString();
		var log = 'Request: ' + timestamp +' '+ req.method +' '+ req.url;
		console.log(log);
		next();
	}
}