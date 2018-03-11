const events = require('events');

const MAGIC_STRING = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function createServer() {
	return require('http').createServer(function(request, response) {
		response.writeHead(200, {
			'Content-Type': 'text/plain'
		});
		response.end('Hello World\n');
	}).listen(3000);
}


class WebSocket extends events.EventEmitter {
	constructor(server) {
		super();
		this.server = server || createServer();
		this._init(this.server);
	}
	_init(server) {
		const me = this;
		server
			.on('connection', () => {
				me.emit('connection');
			})
			.on('upgrade', (request, socket, head) => {
				const {
					headers
				} = request;
				// upgrade不为WebSocket
				if (headers.upgrade.toUpperCase() !== 'WEBSOCKET') {
					me.emit('error', {
						code: 401,
						message: '非法的链接'
					});
					return;
				}
				this._switchProtocol(headers, socket);
			})
	}
	_switchProtocol(headers, socket) {
		let key = headers['sec-websocket-key'];
		key = require('crypto').createHash('sha1').update(key + MAGIC_STRING).digest('base64');
		const resHeaders = [
			'HTTP/1.1 101 Switching Protocols',
			'Upgrade: websocket',
			'Connection: Upgrade',
			'Sec-WebSocket-Accept: ' + key
		];
		socket.on('data', (data) => {
			console.log(data);
		});
		socket.write(resHeaders.concat('', '').join('\r\n'));
	}
}

module.exports = WebSocket;