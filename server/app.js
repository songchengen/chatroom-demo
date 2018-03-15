const WebSocket = require('./WebSocket');

function createServer() {
	return require('http').createServer(function(request, response) {
		response.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		response.end('Hello World\n');
	}).listen(3000);
}

const ws = new WebSocket(createServer());
ws.on('connection', () => {
	console.log('connection!');
})
ws.on('error', (err) => {
	console.log(err);
})
ws.on('message', (data, origin, buffer) => {
	console.log(data,origin,buffer);
	ws.send(data + '\n不喜欢你哟', function (payloadObj, socket){
		console.log('\r\nsend success\r\n', payloadObj);
	});
})