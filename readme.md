this project is to make the device for tracking
- concept : we deploy this for dollys of thai-post office that for whole nation
the dolly is for carrying the parcel or packager deliver among center at any provinces


-part
 web app for monitor and  administraator, control
 - also has tab to setting everything require, and setting about lat long of gateway since gw has only device 
 - webdashboard monitor the device across the country atleast 1k devices 
 - to monitor the the device is in which center in the contry, in nation may have such 100 centers
 - pls also calculate the device distance from rssi rougly 
the device communication to center gateway device via lora
 - web platform will deploy in free tool online or cloud, also for map tool prefer free tool no credit cards

 hw
 - gateway center for each center, using esp32 and lora module 
 - client device attached to dolly to send the status to gateway > cloud web app , also the same hardware
 
 
  server brokerr is 110.164.181.55 port 1883
via mqtt

gateway center that will existing in each province and gateway send data to cloud web monitor platform

information about mqtt and messages , data

example receive data fromm toppic heltec/lora/data
data message > {"gateway_id":"gateway1","rssi":-109,"node_id":"node1"}


center gateway mqtt topic 
heltec/gateway/gateway1/status
heltec/gateway/gateway2/status

example data from gw heltec/gateway/gateway1/status
{"gateway_id":"gateway1","status":"ONLINE"}
{"gateway_id":"gateway1","status":"OFFLINE"}

example data from gw heltec/gateway/gateway2/status
{"gateway_id":"gateway2","status":"ONLINE"}
{"gateway_id":"gateway2","status":"OFFLINE"}

for client node heltec/nodes/node1/status
example data
{"node_id":"node1","status":"ONLINE","gateway_id":"gateway2}

heltec/nodes/node2/status
{"node_id":"node2","status":"OFFLINE"}

heltec/nodes/node3/status
{"node_id":"node3","status":"ONLINE","gateway_id":"gateway1}

heltec/lora/data >> this is for rssi information for each node
{"gateway_id":"gateway1","rssi":-99,"node_id":"node3"}
{"gateway_id":"gateway1","rssi":-100,"node_id":"node3"}
{"gateway_id":"gateway2","rssi":-99,"node_id":"node1"}

pls create web platform for this requirements completely and easy ux ui and modern impress
pls make minimal, lively, easy ux, stunning

/thinking
firstly, pls research all about the requirements comprehesively, concept simple, stuning ux ui, lively
design concept ui,ux, user journey,

/implement 
according to requirements with example data above

provide all step to deploy from scratch

pls create web platform and preview