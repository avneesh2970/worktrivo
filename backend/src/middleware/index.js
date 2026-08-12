const express = require("express");
const cors = require("cors");

const setupMiddleware = (app) => {
  app.use(
    cors({
      origin: true, // Dynamically reflects the request origin (effectively allowing all)
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization"],
    })
  );

  app.use(express.json());
};

module.exports = setupMiddleware;