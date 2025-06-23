// proxy.js
const WebSocket = require('ws'); // For local WebSocket server
const mqtt = require('mqtt');     // For connecting to the remote MQTT broker

const WEB_SOCKET_PORT = 9001; // Port your web app will connect to
const MQTT_BROKER_URL = 'mqtt://110.164.181.55:1883'; // Your actual MQTT broker

// 1. Create a WebSocket server
const wss = new WebSocket.Server({ port: WEB_SOCKET_PORT });

console.log(`WebSocket server starting on ws://localhost:${WEB_SOCKET_PORT}`);
console.log(`Attempting to proxy to MQTT broker: ${MQTT_BROKER_URL}`);

wss.on('listening', () => {
    console.log(`WebSocket server is now listening on ws://localhost:${WEB_SOCKET_PORT}`);
});

wss.on('connection', function connection(ws) {
    console.log('New WebSocket client connected from browser.');

    let mqttClient;

    // 2. Connect to the remote MQTT broker for each new WebSocket client
    console.log(`[Proxy] Connecting MQTT client to ${MQTT_BROKER_URL}...`);
    mqttClient = mqtt.connect(MQTT_BROKER_URL);

    mqttClient.on('connect', function () {
        console.log('[Proxy] MQTT client successfully connected to remote broker!');
        // When MQTT client connects, subscribe to the topics the web app needs
        mqttClient.subscribe('heltec/lora/data', { qos: 0 }, (err) => {
            if (err) { console.error("[Proxy] MQTT subscription error for heltec/lora/data:", err); }
            else { console.log("[Proxy] Subscribed to heltec/lora/data"); }
        });
        mqttClient.subscribe('heltec/gateway/+/status', { qos: 0 }, (err) => {
            if (err) { console.error("[Proxy] MQTT subscription error for heltec/gateway/+/status:", err); }
            else { console.log("[Proxy] Subscribed to heltec/gateway/+/status"); }
        });
        mqttClient.subscribe('heltec/nodes/+/status', { qos: 0 }, (err) => {
            if (err) { console.error("[Proxy] MQTT subscription error for heltec/nodes/+/status:", err); }
            else { console.log("[Proxy] Subscribed to heltec/nodes/+/status"); }
        });
    });

    mqttClient.on('message', function (topic, message) {
        // Log the incoming MQTT message for debugging
        console.log(`[Proxy DEBUG - MQTT_IN] Topic: ${topic}, Message: ${message.toString()}`);

        // Forward MQTT messages from the broker to the connected WebSocket client
        // Package topic and payload into a JSON object for the browser client to parse.
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ topic: topic, payload: message.toString() }));
                // console.log(`[Proxy DEBUG - WS_OUT] Forwarded message for topic ${topic} to WebSocket client.`);
            } catch (e) {
                console.error("[Proxy] Error sending message to WebSocket client:", e);
            }
        }
    });

    mqttClient.on('error', function (err) {
        console.error('[Proxy ERROR] MQTT client connection error to remote broker:', err);
        // Inform the WebSocket client about the error
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ error: `MQTT Broker Connection Error: ${err.message}` }));
            } catch (e) {
                console.error("[Proxy] Error sending error message to WebSocket client:", e);
            }
        }
        // End MQTT connection on error, which will trigger 'close' event
        mqttClient.end();
    });

    mqttClient.on('close', function () {
        console.log('[Proxy] MQTT client disconnected from remote broker.');
        // If the MQTT client disconnects, close the corresponding WebSocket connection
        if (ws.readyState === WebSocket.OPEN) {
            ws.close(); // This will trigger ws.on('close') on the WebSocket server side
        }
    });

    mqttClient.on('offline', function() {
        console.warn('[Proxy] MQTT client went offline (connection lost, but not explicitly closed).');
        // This can also indicate a connection issue.
    });

    // Handle messages from the WebSocket client (if your web app needed to publish)
    ws.on('message', function incoming(message) {
        console.log('[Proxy DEBUG - WS_IN] Received message from WebSocket client:', message.toString());
        try {
            const msg = JSON.parse(message.toString());
            if (msg.type === 'publish' && msg.topic && msg.payload) {
                mqttClient.publish(msg.topic, JSON.stringify(msg.payload), { qos: 0, retain: false }, (err) => {
                    if (err) {
                        console.error(`[Proxy ERROR] Error publishing to MQTT broker topic '${msg.topic}':`, err);
                    } else {
                        console.log(`[Proxy DEBUG - MQTT_OUT] Successfully published: Topic=${msg.topic}, Payload=${JSON.stringify(msg.payload)}`);
                    }
                });
            }
        } catch (e) {
            console.warn('[Proxy WARNING] Could not parse WebSocket message as JSON (expected for publish actions):', e.message);
        }
    });

    ws.on('close', function close(code, reason) {
        console.log(`WebSocket client disconnected. Code: ${code}, Reason: ${reason ? reason.toString() : 'N/A'}`);
        // Ensure MQTT client is ended when WebSocket client disconnects
        if (mqttClient && mqttClient.connected) {
            mqttClient.end();
            console.log('[Proxy] MQTT client disconnected due to WebSocket client closing.');
        }
    });

    ws.on('error', function wsError(err) {
        console.error('[Proxy ERROR] WebSocket error with client connection:', err);
        if (mqttClient && mqttClient.connected) {
            mqttClient.end();
        }
    });
});

wss.on('error', (err) => {
    console.error('[Proxy ERROR] WebSocket server error:', err);
});