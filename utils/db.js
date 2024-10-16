const { MongoClient } = require('mongodb');
const dotenv = require('dotenv');

dotenv.config(); // Load environment variables from .env file

class DBClient {
  constructor() {
    const host = process.env.DB_HOST || 'localhost';
    const port = process.env.DB_PORT || 27017;
    const database = process.env.DB_DATABASE || 'files_manager';
    
    const url = `mongodb://${host}:${port}`;
    this.client = new MongoClient(url, { useUnifiedTopology: true });
    this.db = null;

    this.client.connect()
      .then(() => {
        this.db = this.client.db(database);
      })
      .catch((err) => {
        console.error('MongoDB Client Error:', err);
      });
  }

  // Check if MongoDB connection is alive
  isAlive() {
    return this.client.isConnected();
  }

  // Get the number of documents in the 'users' collection
  async nbUsers() {
    if (!this.db) return 0;
    return this.db.collection('users').countDocuments();
  }

  // Get the number of documents in the 'files' collection
  async nbFiles() {
    if (!this.db) return 0;
    return this.db.collection('files').countDocuments();
  }
}

// Create and export an instance of DBClient
const dbClient = new DBClient();
module.exports = dbClient;