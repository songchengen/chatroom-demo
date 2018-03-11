// const WebSocket = require('./websocket');
// try {
//   const socketEvent =  WebSocket();
//   socketEvent.on('error', (arg) => {
//     console.log(arg);
//   })
// } catch(e) {
//   // statements
//   console.log('err')
//   console.log(e);
// }

const WebSocket = require('./WebSocket');
const ws = new WebSocket();
ws.on('connection', () => {
	console.log('connection!');
})
ws.on('error', (err) => {
	console.log(err);
})