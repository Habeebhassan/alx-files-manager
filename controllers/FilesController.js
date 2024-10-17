// controllers/FilesController.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const { ObjectId } = require('mongodb');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');
const Bull = require('bull');
const fileQueue = new Bull('fileQueue');

class FilesController {
  static async postUpload(req, res) {
    const token = req.headers['x-token'];

    // Check if the token exists
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Extract file metadata from the request body
    const { name, type, parentId = 0, isPublic = false, data } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({ error: 'Missing name' });
    }

    if (!type || !['folder', 'file', 'image'].includes(type)) {
      return res.status(400).json({ error: 'Missing type' });
    }

    if (type !== 'folder' && !data) {
      return res.status(400).json({ error: 'Missing data' });
    }

    // Check parentId validity (if provided)
    if (parentId !== 0) {
      const parentFile = await dbClient.db.collection('files').findOne({ _id: dbClient.objectId(parentId) });
      if (!parentFile) {
        return res.status(400).json({ error: 'Parent not found' });
      }

      if (parentFile.type !== 'folder') {
        return res.status(400).json({ error: 'Parent is not a folder' });
      }
    }

    // Prepare the file document for the database
    const fileDocument = {
      userId: dbClient.objectId(userId),
      name,
      type,
      isPublic,
      parentId: parentId === 0 ? 0 : dbClient.objectId(parentId),
      createdAt: new Date(),
    };

    // Handle file saving if type is file or image
    if (type === 'file' || type === 'image') {
      const folderPath = process.env.FOLDER_PATH || '/tmp/files_manager';
      if (!fs.existsSync(folderPath)) {
        fs.mkdirSync(folderPath, { recursive: true });
      }

      const fileUUID = uuidv4();
      const localPath = path.join(folderPath, fileUUID);

      // Decode Base64 data and save the file
      const fileData = Buffer.from(data, 'base64');
      fs.writeFileSync(localPath, fileData);

      // Add file-specific properties to the document
      fileDocument.localPath = localPath;
    }

    // Insert the file document into the database
    const result = await dbClient.db.collection('files').insertOne(fileDocument);

    // Return the file information
    return res.status(201).json({
      id: result.insertedId,
      userId: userId,
      name,
      type,
      isPublic,
      parentId: fileDocument.parentId,
    });
  }

  // Method to publish a file (set isPublic to true)
  static async putPublish(req, res) {
    const token = req.headers['x-token'];

    // Check if the user is authenticated
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the file by its ID and check if it belongs to the user
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update the isPublic field to true (publish the file)
    await dbClient.db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { isPublic: true } }
    );

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });

    return res.status(200).json(updatedFile);
  }

  // Method to unpublish a file (set isPublic to false)
  static async putUnpublish(req, res) {
    const token = req.headers['x-token'];

    // Check if the user is authenticated
    const userId = await redisClient.get(`auth_${token}`);
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Find the file by its ID and check if it belongs to the user
    const fileId = req.params.id;
    const file = await dbClient.db.collection('files').findOne({
      _id: new ObjectId(fileId),
      userId: new ObjectId(userId),
    });

    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Update the isPublic field to false (unpublish the file)
    await dbClient.db.collection('files').updateOne(
      { _id: new ObjectId(fileId) },
      { $set: { isPublic: false } }
    );

    const updatedFile = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });

    return res.status(200).json(updatedFile);
  }
  // Method to get the file content by ID
  static async getFile(req, res) {
    const fileId = req.params.id;
    const token = req.headers['x-token'];
    const size = req.query.size;

    // Fetch file from the database
    const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId) });
    if (!file) {
      return res.status(404).json({ error: 'Not found' });
    }

    // If the file is a folder, return an error
    if (file.type === 'folder') {
      return res.status(400).json({ error: "A folder doesn't have content" });
    }

    // If the file is not public, check if the user is authenticated and the owner
    if (!file.isPublic) {
      const userId = await redisClient.get(`auth_${token}`);
      if (!userId || file.userId.toString() !== userId.toString()) {
        return res.status(404).json({ error: 'Not found' });
      }
    }

    // Check if the file exists on the disk
    let filePath = file.localPath;
    if (size) {
      const sizes = [100, 250, 500];
      if (!sizes.includes(parseInt(size))) return res.status(400).json({ error: 'Invalid size' });
      filePath = `${file.localPath}_${size}`;
    }
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Not found' });
    }

    // Get the MIME type of the file
    const mimeType = mime.lookup(file.name) || 'application/octet-stream';

    // Read and return the file content
    return res.setHeader('Content-Type', mimeType).status(200).sendFile(path.resolve(filePath));
  }
}

module.exports = FilesController;