const express = require("express");
const cors = require("cors");

const setupMiddleware = (app) => {
  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, postman) or any localhost/dev origin
      callback(null, true);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
    optionsSuccessStatus: 200,
  };

  app.use(cors(corsOptions));

  app.use(express.json());
};

module.exports = setupMiddleware;