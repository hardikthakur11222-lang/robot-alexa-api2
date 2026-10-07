const express = require("express");
const path = require("path");
const Alexa = require("ask-sdk-core");
const { ExpressAdapter } = require("ask-sdk-express-adapter");

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================================
// CONFIGURATION
// ============================================================

const SKILL_ID =
  "amzn1.ask.skill.1e9861ad-6dd3-4d82-bc05-91630ebc085e";

const VALID_DIRECTIONS = [
  "forward",
  "backward",
  "left",
  "right",
  "stop"
];

// ============================================================
// ROBOT STATE
// ============================================================

let robotState = {
  direction: "stop",
  lastCommandAt: null
};

function setRobotDirection(direction) {
  const value = String(direction || "")
    .trim()
    .toLowerCase();

  if (!VALID_DIRECTIONS.includes(value)) {
    console.log(`[ROBOT] Invalid direction: ${value}`);
    return false;
  }

  robotState = {
    direction: value,
    lastCommandAt: new Date().toISOString()
  };

  console.log(`[ROBOT] ${value.toUpperCase()}`);

  return true;
}

// ============================================================
// STATIC WEBSITE
// ============================================================

app.use(express.static(path.join(__dirname, "public")));

// ============================================================
// GLOBAL HTTP LOGGER
// ============================================================

app.use((req, res, next) => {
  console.log(
    `[HTTP] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );

  next();
});

// ============================================================
// API JSON PARSER
//
// IMPORTANT:
// Do NOT put express.json() globally.
// ExpressAdapter handles the Alexa request body.
// ============================================================

app.use("/api", express.json());

// ============================================================
// HEALTH CHECK
// ============================================================

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    service: "robot-api",
    status: "online",
    time: new Date().toISOString()
  });
});

// ============================================================
// ROBOT STATE
// ============================================================

app.get("/api/state", (req, res) => {
  res.json({
    success: true,
    state: robotState
  });
});

// ============================================================
// MOVE ROBOT - POST
// ============================================================

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

// ============================================================
// MOVE ROBOT - GET
// ============================================================

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

// ============================================================
// ALEXA: LAUNCH REQUEST
// ============================================================

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "LaunchRequest"
    );
  },

  handle(handlerInput) {
    console.log("[ALEXA] LaunchRequest received");

    const response = handlerInput.responseBuilder
      .speak("Robot controller is ready.")
      .reprompt(
        "Say move forward, move backward, move left, move right, or stop."
      )
      .getResponse();

    console.log(
      "[ALEXA] Launch response:",
      JSON.stringify(response)
    );

    return response;
  }
};

// ============================================================
// ALEXA: MOVEMENT HANDLER
// ============================================================

function createMoveHandler(intentName, direction, speech) {
  return {
    canHandle(handlerInput) {
      return (
        Alexa.getRequestType(handlerInput.requestEnvelope) ===
          "IntentRequest" &&
        Alexa.getIntentName(handlerInput.requestEnvelope) ===
          intentName
      );
    },

    handle(handlerInput) {
      console.log(`[ALEXA] ${intentName}`);

      setRobotDirection(direction);

      const response = handlerInput.responseBuilder
        .speak(speech)
        .getResponse();

      console.log(
        "[ALEXA] Movement response:",
        JSON.stringify(response)
      );

      return response;
    }
  };
}

const MoveForwardIntentHandler =
  createMoveHandler(
    "MoveForwardIntent",
    "forward",
    "Moving forward."
  );

const MoveBackwardIntentHandler =
  createMoveHandler(
    "MoveBackwardIntent",
    "backward",
    "Moving backward."
  );

const MoveLeftIntentHandler =
  createMoveHandler(
    "MoveLeftIntent",
    "left",
    "Turning left."
  );

const MoveRightIntentHandler =
  createMoveHandler(
    "MoveRightIntent",
    "right",
    "Turning right."
  );

const StopRobotIntentHandler =
  createMoveHandler(
    "StopRobotIntent",
    "stop",
    "Robot stopped."
  );

// ============================================================
// ALEXA: HELP
// ============================================================

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
        "IntentRequest" &&
      Alexa.getIntentName(handlerInput.requestEnvelope) ===
        "AMAZON.HelpIntent"
    );
  },

  handle(handlerInput) {
    return handlerInput.responseBuilder
      .speak(
        "You can say move forward, move backward, move left, move right, or stop."
      )
      .reprompt("What would you like the robot to do?")
      .getResponse();
  }
};

// ============================================================
// ALEXA: STOP / CANCEL
// ============================================================

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    const type = Alexa.getRequestType(
      handlerInput.requestEnvelope
    );

    const intent = Alexa.getIntentName(
      handlerInput.requestEnvelope
    );

    return (
      type === "IntentRequest" &&
      (intent === "AMAZON.CancelIntent" ||
        intent === "AMAZON.StopIntent")
    );
  },

  handle(handlerInput) {
    console.log("[ALEXA] Stop/Cancel");

    setRobotDirection("stop");

    return handlerInput.responseBuilder
      .speak("Robot stopped.")
      .getResponse();
  }
};

// ============================================================
// ALEXA: SESSION ENDED
// ============================================================

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(handlerInput.requestEnvelope) ===
      "SessionEndedRequest"
    );
  },

  handle(handlerInput) {
    console.log("[ALEXA] Session ended");

    console.log(
      "[ALEXA] Session ended reason:",
      handlerInput.requestEnvelope.request.reason
    );

    return handlerInput.responseBuilder.getResponse();
  }
};

// ============================================================
// ALEXA: ERROR HANDLER
// ============================================================

const ErrorHandler = {
  canHandle() {
    return true;
  },

  handle(handlerInput, error) {
    console.error("========================================");
    console.error("[ALEXA ERROR]");
    console.error("Message:", error?.message);
    console.error("Stack:", error?.stack);
    console.error("========================================");

    return handlerInput.responseBuilder
      .speak(
        "Sorry, there was a problem controlling the robot."
      )
      .getResponse();
  }
};

// ============================================================
// BUILD ALEXA SKILL
// ============================================================

const skill = Alexa.SkillBuilders.custom()
  .withSkillId(SKILL_ID)

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

// ============================================================
// EXPRESS ADAPTER
//
// TEMPORARY DEBUG MODE
// Signature verification = false
// Timestamp verification = false
//
// We will enable these after the basic connection works.
// ============================================================

const adapter = new ExpressAdapter(
  skill,
  false,
  false
);

// ============================================================
// ALEXA ENDPOINT
// ============================================================

app.post(
  "/alexa",

  (req, res, next) => {
    console.log("========================================");
    console.log("[ALEXA] POST /alexa received");
    console.log("[ALEXA] Time:", new Date().toISOString());
    console.log("========================================");

    next();
  },

  adapter.getRequestHandlers()
);

// ============================================================
// 404 / FRONTEND FALLBACK
// ============================================================

app.use((req, res) => {
  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// ============================================================
// SERVER ERROR HANDLER
// ============================================================

app.use((err, req, res, next) => {
  console.error("========================================");
  console.error("[SERVER ERROR]");
  console.error("Message:", err?.message);
  console.error("Stack:", err?.stack);
  console.error("========================================");

  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: "Internal server error"
    });
  }
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("ROBOT ALEXA API STARTED");
  console.log(`Port: ${PORT}`);
  console.log(`Alexa Skill ID: ${SKILL_ID}`);
  console.log(`Alexa endpoint: /alexa`);
  console.log("========================================");
});