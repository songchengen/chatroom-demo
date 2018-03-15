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

/*
 * WebSocket类
 * 继承EventEmitter，通过注册事件暴露给用户响应的操作
 */
class WebSocket extends events.EventEmitter {
	constructor(server) {
		super();
		this.server = server || createServer();
		this.socket = null;
		this._init(this.server);
	}
	/*
     * 客户端传入 `upgrade：websocket`时服务端响应，完成握手
     */
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
						code: 440,
						message: '客户端发起了非法的链接'
					});
					return;
				}
				me.socket = socket;
				this._switchProtocol(headers, socket);
			})
	}
	_switchProtocol(headers, socket) {
		const me = this;
		let key = headers['sec-websocket-key'];
		key = require('crypto').createHash('sha1').update(key + MAGIC_STRING).digest('base64');
		const resHeaders = [
			'HTTP/1.1 101 Switching Protocols',
			'Upgrade: websocket',
			'Connection: Upgrade',
			'Sec-WebSocket-Accept: ' + key //生成的key作为客户端的校验值
		];
		socket.on('data', (data) => {
			const payloadObj = me._decode(data);
			
			/*
			 * arguments[1]: 负载消息
			 * arguments[2]: 原始数据，未处理之前的buffer
			 * arguments[2]: 处理后消息对象
			 */
			me.emit('message', payloadObj.data, data, payloadObj);
		});
		socket.write(resHeaders.concat('', '').join('\r\n'));
	}
	// 数据解码
	_decode(data) {
		//保存负载数据的长度
		let payloadData_length;
		// 保存掩码
		let maskingKey;
		//负载数据的其实索引，除掉第一个字节的fin，rsv(1,2,3),opcode，第二个字节的masked，payload length
		let payloadData_index = 2;
		//保存负载数据
		let payloadData;

		/*处理第一个字节*/
		const fin = data[0] & 128;
		const opcode = data[0] & 15;

		/* 处理掩码标志位 */
		//接收到数据帧的第二个字节，表示以为masked和7位的payload length
		const maskedAndPlaloadLength = data[1];
		//masked是第二个字节的第八位，当大于127的时候第八位为1
		const hasMask = maskedAndPlaloadLength >= 128;

		/*处理负载数据长度*/
		//去掉第八位的masked，保留payload length
		const payloadLength = maskedAndPlaloadLength & 127;
		//如果为126，则payload length占7+16位
		if (payloadLength === 126) {
			payloadData_index += 2;
			payloadData_length = data.readUInt16BE(2)
		} else if (payloadLength === 127) {
			//如果为126，则payload length占7+64位
			payloadData_index += 8;
			payloadData_length = data.readUInt32BE(2) + data.readUInt32BE(6);
		} else {
			//如果在0~125之间则直接取第二个字节的低七位作为负载数据的长度
			payloadData_length = payloadLength;
		}

		/*处理掩码*/
		if (hasMask) {
			//读取32位的掩码
			maskingKey = data.slice(payloadData_index, payloadData_index + 4);
			payloadData_index += 4;
			payloadData = new Buffer(data.length, payloadData_index);
			//解码负载数据
			for (let i = payloadData_index, j = 0; i < data.length; i++, j++) {
				payloadData[j] = data[i] ^ maskingKey[j % 4];
			}
		} else {
			payloadData = data.slice(payloadData_index, data.length);
		}
		return {
			index: payloadData_index,
			length: payloadData_length,
			data: payloadData.toString(),
			hasMask,
			maskingKey,
			fin,
			opcode,
			origin: data
		};
	}
	//数据编码
	_encode(data) {

	}
	/*
	 * data : 需要发送到接收方的负载消息
	 * callback： 回调函数，包括处理过后的消息对象，以及socket
	 */
	send(data, callback = function (){}) {
		if (!this.socket) {
			this.emit('error', {
				code: 550,
				message: '引用空的socket'
			});
			return;
		}

		let message = String(data);
		// 取得消息的字符长度
		const messageLength = Buffer.byteLength(message);

		// 定义响应buffer中的帧数据对象
		let bufferObj = {
			fin: 1,
			opcode: 1,
			hasMask: false,
			index: 2,
			length: messageLength,
			data: message,
			buffer: null
		}
		// 确定负载数据的偏移量
		bufferObj['index'] += messageLength > 65535 ? 8 : (messageLength > 125 ? 2 : 0);
		let buffer = new Buffer(bufferObj['index'] + messageLength);
		buffer[0] = 129;
		/*
		 * 将消息分为三类
		 * 1、7位二进制长度以内的
		 * 2、16位二进制长度以内
		 * 3、64位二进制长度以内
		 */
		if (messageLength < 126) {
			buffer[1] = messageLength;
		} else if (messageLength < Math.pow(2, 16)) {
			buffer.push(
				126,
				(messageLength & 0xFF00) >> 8,
				messageLength & 0xFF
			)
		} else {
			// 假设数据段的长度可以用32位表示
			buffer.push(
				126,
				0,0,0,0,
				(messageLength & 0xFF000000) >> 24,
				(messageLength & 0xFF0000) >> 16,
				(messageLength & 0xFF00) >> 8,
				messageLength & 0xFF
			)
		}
		buffer.write(message, bufferObj['index']);
		bufferObj['buffer'] = buffer;
		// 回调人类理解的数据结构, 以及socket
		callback(bufferObj, this.socket);
		this.socket.write(buffer)
	}
}

module.exports = WebSocket;