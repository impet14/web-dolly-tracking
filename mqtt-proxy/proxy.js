// proxy.js
// This script runs on Node.js and acts as an intermediary between the browser-based
// web application and the remote MQTT broker. It uses WebSockets for browser communication
// and MQTT.js library for MQTT broker interaction.

const WebSocket = require('ws'); // For creating a local WebSocket server
const mqtt = require('mqtt');     // For connecting to the remote MQTT broker

// Configuration for WebSocket server and MQTT broker
const WEB_SOCKET_PORT = 9001; // Port your web app will connect to (e.g., ws://localhost:9001)
const MQTT_BROKER_URL = 'mqtt://110.164.181.55:1883'; // Your actual MQTT broker address

// 1. Create a WebSocket server instance
const wss = new WebSocket.Server({ port: WEB_SOCKET_PORT });

console.log(`[Proxy] WebSocket server starting on ws://localhost:${WEB_SOCKET_PORT}`);
console.log(`[Proxy] Attempting to proxy to MQTT broker: ${MQTT_BROKER_URL}`);

// Event listener for when the WebSocket server starts listening
wss.on('listening', () => {
    console.log(`[Proxy] WebSocket server is now listening on ws://localhost:${WEB_SOCKET_PORT}`);
});

// Event listener for new WebSocket client connections from browsers
wss.on('connection', function connection(ws) {
    console.log('[Proxy] New WebSocket client connected from browser.');

    let mqttClient; // MQTT client instance for this specific WebSocket connection

    // 2. Connect to the remote MQTT broker for each new WebSocket client
    // This ensures isolation: if one browser disconnects, its MQTT connection is cleaned up.
    console.log(`[Proxy] Connecting MQTT client to ${MQTT_BROKER_URL}...`);
    mqttClient = mqtt.connect(MQTT_BROKER_URL);

    // MQTT Client Event: 'connect' - fired when the MQTT client successfully connects to the broker
    mqttClient.on('connect', function () {
        console.log('[Proxy] MQTT client successfully connected to remote broker!');
        // Once connected, subscribe to the MQTT topics that the web app needs to receive data from.
        // QoS (Quality of Service) 0 means at most once delivery.
        mqttClient.subscribe('heltec/lora/data', { qos: 0 }, (err) => {
            if (err) { console.error("[Proxy ERROR] MQTT subscription error for heltec/lora/data:", err); }
            else { console.log("[Proxy] Subscribed to heltec/lora/data"); }
        });
        mqttClient.subscribe('heltec/gateway/+/status', { qos: 0 }, (err) => {
            if (err) { console.error("[Proxy ERROR] MQTT subscription error for heltec/gateway/+/status:", err); }
            else { console.log("[Proxy] Subscribed to heltec/gateway/+/status"); }
        });
        mqttClient.subscribe('heltec/nodes/+/status', { qos: 0 }, (err) => {
            if (err) { console.error("[Proxy ERROR] MQTT subscription error for heltec/nodes/+/status:", err); }
            else { console.log("[Proxy] Subscribed to heltec/nodes/+/status"); }
        });
        
        // Notify the connected WebSocket client that the MQTT connection is established.
        // This allows the frontend to update its status display.
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ status: 'connected' }));
            } catch (e) {
                console.error("[Proxy ERROR] Error sending connection status to WebSocket client:", e);
            }
        }
    });

    // MQTT Client Event: 'message' - fired when a message is received on a subscribed topic
    mqttClient.on('message', function (topic, message) {
        // Log the incoming MQTT message for debugging purposes (can be verbose)
        // console.log(`[Proxy DEBUG - MQTT_IN] Topic: ${topic}, Message: ${message.toString()}`);

        // Forward the received MQTT message to the connected WebSocket client.
        // The message is packaged into a JSON object containing the topic and payload.
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ topic: topic, payload: message.toString() }));
                // console.log(`[Proxy DEBUG - WS_OUT] Forwarded message for topic ${topic} to WebSocket client.`);
            } catch (e) {
                console.error("[Proxy ERROR] Error sending message to WebSocket client:", e);
            }
        }
    });

    // MQTT Client Event: 'error' - fired when the MQTT client encounters an error
    mqttClient.on('error', function (err) {
        console.error('[Proxy ERROR] MQTT client connection error to remote broker:', err);
        // Inform the WebSocket client about the MQTT connection error.
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ error: `MQTT Broker Connection Error: ${err.message}`, status: 'disconnected' }));
            } catch (e) {
                console.error("[Proxy ERROR] Error sending error message to WebSocket client:", e);
            }
        }
        // End the MQTT connection on error to ensure a clean state and trigger 'close' event.
        mqttClient.end();
    });

    // MQTT Client Event: 'close' - fired when the MQTT client is disconnected from the broker
    mqttClient.on('close', function () {
        console.log('[Proxy] MQTT client disconnected from remote broker.');
        // If the MQTT client disconnects, also close the corresponding WebSocket connection.
        // This helps in resynchronizing the frontend's connection state.
        if (ws.readyState === WebSocket.OPEN) {
            ws.close(); // This will trigger ws.on('close') on the WebSocket server side
        }
    });

    // MQTT Client Event: 'offline' - fired when the MQTT client goes offline (e.g., network lost)
    mqttClient.on('offline', function() {
        console.warn('[Proxy WARNING] MQTT client went offline (connection lost, but not explicitly closed).');
        // Inform the WebSocket client about the offline status.
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify({ error: 'MQTT Client Offline: Connection lost', status: 'disconnected' }));
            } catch (e) {
                console.error("[Proxy ERROR] Error sending offline status to WebSocket client:", e);
            }
        }
    });

    // WebSocket Server Event: 'message' - fired when the WebSocket server receives a message from a client
    // This part handles messages sent FROM the web app (e.g., if the web app needed to publish data)
    ws.on('message', function incoming(message) {
        console.log('[Proxy DEBUG - WS_IN] Received message from WebSocket client:', message.toString());
        try {
            const msg = JSON.parse(message.toString());
            // Check if the message is a 'publish' request with valid topic and payload
            if (msg.type === 'publish' && msg.topic && msg.payload !== undefined) {
                mqttClient.publish(msg.topic, JSON.stringify(msg.payload), { qos: 0, retain: false }, (err) => {
                    if (err) {
                        console.error(`[Proxy ERROR] Error publishing to MQTT broker topic '${msg.topic}':`, err);
                        // Send error feedback back to the WebSocket client
                        if (ws.readyState === WebSocket.OPEN) {
                            ws.send(JSON.stringify({ error: `Publish failed to ${msg.topic}: ${err.message}` }));
                        }
                    } else {
                        console.log(`[Proxy DEBUG - MQTT_OUT] Successfully published: Topic=${msg.topic}, Payload=${JSON.stringify(msg.payload)}`);
                    }
                });
            } else {
                console.warn('[Proxy WARNING] Received WebSocket message without "publish" type, topic, or payload:', msg);
                // Inform the WebSocket client about invalid message format
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ error: 'Invalid WebSocket message format. Expected {type: "publish", topic: "...", payload: "..."}' }));
                }
            }
        } catch (e) {
            console.warn('[Proxy WARNING] Could not parse WebSocket message as JSON (expected for publish actions):', e.message);
            // Inform the WebSocket client about JSON parsing errors
            if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ error: `Invalid message format: ${e.message}` }));
            }
        }
    });

    // WebSocket Server Event: 'close' - fired when a WebSocket client disconnects
    ws.on('close', function close(code, reason) {
        console.log(`[Proxy] WebSocket client disconnected. Code: ${code}, Reason: ${reason ? reason.toString() : 'N/A'}`);
        // Ensure the corresponding MQTT client connection is ended when the WebSocket client closes.
        if (mqttClient && mqttClient.connected) {
            mqttClient.end();
            console.log('[Proxy] MQTT client disconnected due to WebSocket client closing.');
        }
    });

    // WebSocket Server Event: 'error' - fired when a WebSocket client connection encounters an error
    ws.on('error', function wsError(err) {
        console.error('[Proxy ERROR] WebSocket error with client connection:', err);
        // Ensure MQTT client is ended on WebSocket error to prevent orphaned connections.
        if (mqttClient && mqttClient.connected) {
            mqttClient.end();
        }
    });
});

// WebSocket Server Event: 'error' - fired when the WebSocket server itself encounters an error
wss.on('error', (err) => {
    console.error('[Proxy ERROR] WebSocket server error:', err);
});
