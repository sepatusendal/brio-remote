import express from 'express';
import cors from 'cors';
import { WebSocketServer } from './websocket/server.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/health', (req,res)=>{
  res.json({
    service:'brio-server',
    status:'ok'
  });
});

const server = app.listen(3000, ()=>{
  console.log('Brio Server running on port 3000');
});

new WebSocketServer(server);
