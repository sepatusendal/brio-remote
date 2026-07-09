import { WebSocketServer as WS } from 'ws';

export class WebSocketServer {
  constructor(server){
    this.wss = new WS({server});

    this.wss.on('connection',(socket)=>{
      console.log('WebSocket client connected');

      socket.on('message',(data)=>{
        console.log('Message:', data.toString());
      });

      socket.send(JSON.stringify({
        type:'CONNECTED',
        message:'Welcome to Brio'
      }));
    });
  }
}
