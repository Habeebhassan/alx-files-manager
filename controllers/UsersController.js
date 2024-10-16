// controllers/UsersController.js

const crypto = require('crypto');
const dbClient = require('../utils/db');

class UsersController {
  // POST /users
  static async postNew(req, res) {
    const { email, password } = req.body;

    // Check if email is provided
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    // Check if password is provided
    if (!password) {
      return res.status(400).json({ error: 'Missing password' });
    }

    // Check if the email already exists in the database
    const existingUser = await dbClient.db.collection('users').findOne({ email });
    if (existingUser) {
      return res.status(400).json({ error: 'Already exist' });
    }

    // Hash the password using SHA1
    const hashedPassword = crypto.createHash('sha1').update(password).digest('hex');

    // Create a new user document
    const newUser = {
      email,
      password: hashedPassword,
    };

    // Insert the new user into the database
    try {
      const result = await dbClient.db.collection('users').insertOne(newUser);

      // Respond with the new user's ID and email
      return res.status(201).json({ id: result.insertedId, email });
    } catch (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }
}

module.exports = UsersController;