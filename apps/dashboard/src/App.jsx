import { useEffect, useState } from "react";
import axios from "axios";

export default function App() {

    const [devices, setDevices] = useState([]);

    async function loadDevices() {

        try {

            const res = await axios.get("http://localhost:3000/devices");

            setDevices(res.data);

        } catch (e) {

            console.log(e);

        }

    }

    useEffect(() => {

        loadDevices();

        const timer = setInterval(loadDevices,2000);

        return ()=>clearInterval(timer);

    },[]);

    async function connect(deviceId){

        const res = await axios.post(
            "http://localhost:3000/connect",
            {deviceId}
        );

        console.log(res.data);

    }

    return (

        <div style={{
            maxWidth:800,
            margin:"40px auto",
            fontFamily:"Arial"
        }}>

            <h1>Brio Dashboard</h1>

            {devices.map(device=>(

                <div
                    key={device.deviceId}
                    style={{
                        border:"1px solid #ddd",
                        borderRadius:10,
                        padding:20,
                        marginBottom:15
                    }}
                >

                    <h3>{device.deviceId}</h3>

                    <p>

                        {device.online
                        ? "🟢 Online"
                        : "🔴 Offline"}

                    </p>

                    <button
                        onClick={()=>connect(device.deviceId)}
                    >

                        Connect

                    </button>

                </div>

            ))}

        </div>

    );

}
