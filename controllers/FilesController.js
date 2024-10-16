// controllers/FilesController.js

const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const mime = require('mime-types');
const redisClient = require('../utils/redis');
const dbClient = require('../utils/db');

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

    if (!['folder', 'file', 'image'].includes(type)) {
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
}

module.exports = FilesController;