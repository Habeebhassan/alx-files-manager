// server.js

const express = require('express');
const routes = require('./routes');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

const app = express();
const port = process.env.PORT || 5000;

// Load all routes from routes/index.js
app.use('/', routes);

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

module.exports = app;