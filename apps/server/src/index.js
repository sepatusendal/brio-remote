import express from "express";
import http from "http";
import cors from "cors";
import { BrioSocket, clients, devices } from "./websocket/server.js";


const app = express();

app.use(cors());
app.use(express.json());


app.get("/health",(req,res)=>{

    res.json({
        ok:true
    });

});


app.get("/devices",(req,res)=>{

    res.json(
        Array.from(devices.values())
    );

});


app.post("/connect",(req,res)=>{

    const socket = clients.get(
        req.body.deviceId
    );


    if(!socket){

        return res.json({
            ok:false
        });

    }


    socket.send(JSON.stringify({

        type:"PING"

    }));


    res.json({
        ok:true
    });


});



const server = http.createServer(app);


new BrioSocket(server);


server.listen(3000,()=>{

    console.log(
        "🚀 Brio Server running :3000"
    );

});
