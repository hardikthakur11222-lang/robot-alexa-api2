# Robot Alexa API — Clean Rebuild

Architecture:
Web / Alexa -> Node.js API -> future MQTT/WebSocket -> ESP32 -> motor driver -> robot

## Local
npm install
npm start

Open http://localhost:3000/

Health:
http://localhost:3000/api/health

Test:
http://localhost:3000/api/move/forward
http://localhost:3000/api/move/backward
http://localhost:3000/api/move/left
http://localhost:3000/api/move/right
http://localhost:3000/api/move/stop

## Render
Build command: npm install
Start command: npm start
No environment variables are required.

Alexa endpoint:
https://YOUR-RENDER-SERVICE.onrender.com/alexa

IMPORTANT: use /alexa, not only the root domain.

## Alexa custom intents
MoveForwardIntent
MoveBackwardIntent
MoveLeftIntent
MoveRightIntent
StopRobotIntent

After Alexa + Render are confirmed working, the next phase is ESP32/MQTT integration.
