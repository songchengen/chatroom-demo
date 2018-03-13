const WebSocket = require('./WebSocket');

const ws = new WebSocket();
ws.on('connection', () => {
	console.log('connection!');
})
ws.on('error', (err) => {
	console.log(err);
})
ws.on('message', (data) => {
	console.log(data);
	ws.send()
})