const express = require("express");
const path = require("path");
const Alexa = require("ask-sdk-core");
const { ExpressAdapter } = require("ask-sdk-express-adapter");

const app = express();
const PORT = process.env.PORT || 3000;

const SKILL_ID =
  "amzn1.ask.skill.1e9861ad-6dd3-4d82-bc05-91630ebc085e";

const VALID_DIRECTIONS = [
  "forward",
  "backward",
  "left",
  "right",
  "stop"
];

let robotState = {
  direction: "stop",
  lastCommandAt: null
};

// ======================================================
// GLOBAL JSON BODY PARSER
// ======================================================

app.use(
  express.json({
    limit: "1mb"
  })
);

// ======================================================
// STATIC WEBSITE
// ======================================================

app.use(express.static(path.join(__dirname, "public")));

// ======================================================
// HTTP LOGGER
// ======================================================

app.use((req, res, next) => {
  console.log(
    `[HTTP] ${new Date().toISOString()} ${req.method} ${req.originalUrl}`
  );

  next();
});

// ======================================================
// ROBOT CONTROL
// ======================================================

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

  console.log(
    `[ROBOT] Direction: ${value.toUpperCase()}`
  );

  return true;
}

// ======================================================
// HEALTH API
// ======================================================

app.get("/api/health", (req, res) => {
  console.log("[API] Health check");

  res.json({
    success: true,
    service: "robot-api",
    status: "online",
    time: new Date().toISOString()
  });
});

// ======================================================
// STATE API
// ======================================================

app.get("/api/state", (req, res) => {
  console.log("[API] State requested");

  res.json({
    success: true,
    state: robotState
  });
});

// ======================================================
// POST MOVE API
// ======================================================

app.post("/api/move", (req, res) => {
  console.log("[API] POST /api/move");
  console.log(
    "[API] Body:",
    JSON.stringify(req.body, null, 2)
  );

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

// ======================================================
// GET MOVE API
// ======================================================

app.get("/api/move/:direction", (req, res) => {
  console.log(
    `[API] GET /api/move/${req.params.direction}`
  );

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

// ======================================================
// ALEXA LAUNCH REQUEST
// ======================================================

const LaunchRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(
        handlerInput.requestEnvelope
      ) === "LaunchRequest"
    );
  },

  handle(handlerInput) {
    console.log("========================================");
    console.log("[ALEXA] LaunchRequest received");
    console.log("========================================");

    const response = handlerInput.responseBuilder
      .speak("Robot controller is ready.")
      .reprompt(
        "Say move forward, move backward, move left, move right, or stop."
      )
      .getResponse();

    console.log(
      "[ALEXA] Launch response:",
      JSON.stringify(response, null, 2)
    );

    return response;
  }
};

// ======================================================
// MOVE INTENT FACTORY
// ======================================================

function createMoveHandler(
  intentName,
  direction,
  speech
) {
  return {
    canHandle(handlerInput) {
      return (
        Alexa.getRequestType(
          handlerInput.requestEnvelope
        ) === "IntentRequest" &&
        Alexa.getIntentName(
          handlerInput.requestEnvelope
        ) === intentName
      );
    },

    handle(handlerInput) {
      console.log(
        `[ALEXA] Intent: ${intentName}`
      );

      setRobotDirection(direction);

      const response = handlerInput.responseBuilder
        .speak(speech)
        .getResponse();

      console.log(
        "[ALEXA] Response:",
        JSON.stringify(response, null, 2)
      );

      return response;
    }
  };
}

// ======================================================
// MOVE INTENTS
// ======================================================

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

// ======================================================
// HELP
// ======================================================

const HelpIntentHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(
        handlerInput.requestEnvelope
      ) === "IntentRequest" &&
      Alexa.getIntentName(
        handlerInput.requestEnvelope
      ) === "AMAZON.HelpIntent"
    );
  },

  handle(handlerInput) {
    console.log("[ALEXA] HelpIntent received");

    return handlerInput.responseBuilder
      .speak(
        "You can say move forward, move backward, move left, move right, or stop."
      )
      .reprompt(
        "What would you like the robot to do?"
      )
      .getResponse();
  }
};

// ======================================================
// STOP / CANCEL
// ======================================================

const CancelAndStopIntentHandler = {
  canHandle(handlerInput) {
    const requestType =
      Alexa.getRequestType(
        handlerInput.requestEnvelope
      );

    const intentName =
      Alexa.getIntentName(
        handlerInput.requestEnvelope
      );

    return (
      requestType === "IntentRequest" &&
      (
        intentName === "AMAZON.CancelIntent" ||
        intentName === "AMAZON.StopIntent"
      )
    );
  },

  handle(handlerInput) {
    console.log(
      "[ALEXA] Stop/Cancel received"
    );

    setRobotDirection("stop");

    return handlerInput.responseBuilder
      .speak("Robot stopped.")
      .getResponse();
  }
};

// ======================================================
// SESSION ENDED
// ======================================================

const SessionEndedRequestHandler = {
  canHandle(handlerInput) {
    return (
      Alexa.getRequestType(
        handlerInput.requestEnvelope
      ) === "SessionEndedRequest"
    );
  },

  handle(handlerInput) {
    console.log("[ALEXA] Session ended");

    return handlerInput.responseBuilder
      .getResponse();
  }
};

// ======================================================
// ERROR HANDLER
// ======================================================

const ErrorHandler = {
  canHandle() {
    return true;
  },

  handle(handlerInput, error) {
    console.error("========================================");
    console.error("[ALEXA ERROR]");
    console.error("Name:", error?.name);
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

// ======================================================
// CREATE ALEXA SKILL
// ======================================================

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

// ======================================================
// EXPRESS ADAPTER
// ======================================================

const adapter = new ExpressAdapter(
  skill,
  false,
  false
);

// ======================================================
// ALEXA ENDPOINT
// ======================================================

app.post(
  "/alexa",

  (req, res, next) => {
    console.log("========================================");
    console.log("[ALEXA] POST /alexa received");
    console.log(
      "[ALEXA] Time:",
      new Date().toISOString()
    );

    console.log(
      "[ALEXA] Headers:",
      JSON.stringify(req.headers, null, 2)
    );

    console.log(
      "[ALEXA] Body:",
      JSON.stringify(req.body, null, 2)
    );

    console.log("========================================");

    next();
  },

  adapter.getRequestHandlers()
);

// ======================================================
// CATCH-ALL
// ======================================================

app.use((req, res) => {
  console.log(
    `[HTTP] Catch-all: ${req.method} ${req.originalUrl}`
  );

  res.sendFile(
    path.join(__dirname, "public", "index.html")
  );
});

// ======================================================
// GLOBAL ERROR HANDLER
// ======================================================

app.use((err, req, res, next) => {
  console.error("========================================");
  console.error("[SERVER ERROR]");
  console.error("Name:", err?.name);
  console.error("Message:", err?.message);
  console.error("Stack:", err?.stack);
  console.error("========================================");

  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: "Internal server error",
      message: err?.message || "Unknown server error"
    });
  }
});

// ======================================================
// START SERVER
// ======================================================

app.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("ROBOT API SERVER STARTED");
  console.log("========================================");
  console.log(`Port: ${PORT}`);
  console.log(`Health: /api/health`);
  console.log(`State: /api/state`);
  console.log(`Move: /api/move/:direction`);
  console.log(`Alexa: /alexa`);
  console.log(`Skill ID: ${SKILL_ID}`);
  console.log("========================================");
});