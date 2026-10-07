const express = require("express");
const path = require("path");
const Alexa = require("ask-sdk-core");
const { ExpressAdapter } = require("ask-sdk-express-adapter");

const app = express();
const PORT = process.env.PORT || 3000;

const VALID_DIRECTIONS = ["forward", "backward", "left", "right", "stop"];

let robotState = { direction: "stop", lastCommandAt: null };

function setRobotDirection(direction) {
  const value = String(direction || "").trim().toLowerCase();
  if (!VALID_DIRECTIONS.includes(value)) {
    console.log(`[ROBOT] Invalid direction: ${value}`);
    return false;
  }
  robotState = { direction: value, lastCommandAt: new Date().toISOString() };
  console.log(`[ROBOT] ${value.toUpperCase()}`);
  return true;
}

app.use(express.static(path.join(__dirname, "public")));

app.use((req, res, next) => {
  console.log(`[HTTP] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`);
  next();
});

// Keep JSON parsing away from /alexa. ExpressAdapter handles Alexa's body.
app.use("/api", express.json());

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "robot-api",
    status: "online",
    time: new Date().toISOString()
  });
});

app.get("/api/state", (req, res) => {
  res.json({ success: true, state: robotState });
});

app.post("/api/move", (req, res) => {
  const direction = req.body?.direction;

  if (!direction) {
    return res.status(400).json({
      success: false,
      error: "Direction is required",
      validDirections: VALID_DIRECTIONS
    });
  }

  if (!setRobotDirection(direction)) {
    return res.status(400).json({
      success: false,
      error: "Invalid direction",
      validDirections: VALID_DIRECTIONS
    });
  }

  res.json({
    success: true,
    direction: robotState.direction,
    timestamp: robotState.lastCommandAt
  });
});

app.get("/api/move/:direction", (req, res) => {
  if (!setRobotDirection(req.params.direction)) {
    return res.status(400).json({
      success: false,
      error: "Invalid direction",
      validDirections: VALID_DIRECTIONS
    });
  }

  res.json({
    success: true,
    direction: robotState.direction,
    timestamp: robotState.lastCommandAt
  });
});

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "LaunchRequest";
  },
  handle(handlerInput) {
    console.log("[ALEXA] LaunchRequest received");
    return handlerInput.responseBuilder
      .speak("Robot controller is ready.")
      .reprompt("Say move forward, move backward, move left, move right, or stop.")
      .getResponse();
  }
};

function createMoveHandler(intentName, direction, speech) {
  return {
    canHandle(handlerInput) {
      return (
        Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
        Alexa.getIntentName(handlerInput.requestEnvelope) === intentName
      );
    },
    handle(handlerInput) {
      console.log(`[ALEXA] ${intentName}`);
      setRobotDirection(direction);
      return handlerInput.responseBuilder.speak(speech).getResponse();
    }
  };
}

const MoveForwardIntentHandler =
  createMoveHandler("MoveForwardIntent", "forward", "Moving forward.");

const MoveBackwardIntentHandler =
  createMoveHandler("MoveBackwardIntent", "backward", "Moving backward.");

const MoveLeftIntentHandler =
  createMoveHandler("MoveLeftIntent", "left", "Turning left.");

const MoveRightIntentHandler =
  createMoveHandler("MoveRightIntent", "right", "Turning right.");

const StopRobotIntentHandler =
  createMoveHandler("StopRobotIntent", "stop", "Robot stopped.");

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) === "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) === "AMAZON.HelpIntent"
    );
  },
  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak("You can say move forward, move backward, move left, move right, or stop.")
      .reprompt("What would you like the robot to do?")
      .getResponse();
  }
};

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    const type = Alexa.getRequestType(handlerInput.requestEnvelope);
    const intent = Alexa.getIntentName(handlerInput.requestEnvelope);
    return (
      type === "IntentRequest" &&
      (intent === "AMAZON.CancelIntent" || intent === "AMAZON.StopIntent")
    );
  },
  handle(handlerInput) {
    console.log("[ALEXA] Stop/Cancel");
    setRobotDirection("stop");
    return handlerInput.responseBuilder.speak("Robot stopped.").getResponse();
  }
};

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return Alexa.getRequestType(handlerInput.requestEnvelope) === "SessionEndedRequest";
  },
  handle(handlerInput) {
    console.log("[ALEXA] Session ended");
    return handlerInput.responseBuilder.getResponse();
  }
};

const ErrorHandler = {
  canHandle() {
    return true;
  },
  handle(handlerInput, error) {
    console.error("[ALEXA ERROR]", error);
    return handlerInput.responseBuilder
      .speak("Sorry, there was a problem controlling the robot.")
      .getResponse();
  }
};

const skill = Alexa.SkillBuilders.custom()
  .addRequestHandlers(
    LaunchRequestHandler,
    MoveForwardIntentHandler,
    MoveBackwardIntentHandler,
    MoveLeftIntentHandler,
    MoveRightIntentHandler,
    StopRobotIntentHandler,
    HelpIntentHandler,
    CancelAndStopIntentHandler,
    SessionEndedRequestHandler
  )
  .addErrorHandlers(ErrorHandler)
  .create();

// Temporary diagnostic mode. We can enable verification after the basic flow works.
const adapter = new ExpressAdapter(skill, false, false);

app.post(
  "/alexa",
  (req, res, next) => {
    console.log("[ALEXA] POST /alexa received");
    next();
  },
  adapter.getRequestHandlers()
);

app.use((req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.use((err, req, res, next) => {
  console.error("[SERVER ERROR]", err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, error: "Internal server error" });
  }
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Robot API running on http://localhost:${PORT}`);
  console.log(`Alexa endpoint: http://localhost:${PORT}/alexa`);
});
