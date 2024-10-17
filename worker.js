// worker.js

const Bull = require('bull');
const imageThumbnail = require('image-thumbnail');
const dbClient = require('./utils/db');
const fs = require('fs');
const path = require('path');

const fileQueue = new Bull('fileQueue');

fileQueue.process(async (job) => {
  const { userId, fileId } = job.data;
  
  if (!fileId) throw new Error('Missing fileId');
  if (!userId) throw new Error('Missing userId');

  const file = await dbClient.db.collection('files').findOne({ _id: new ObjectId(fileId), userId: new ObjectId(userId) });
  if (!file) throw new Error('File not found');

  const sizes = [500, 250, 100];
  const options = { width: null };

  for (const size of sizes) {
    options.width = size;
    const thumbnail = await imageThumbnail(file.localPath, options);
    const thumbnailPath = `${file.localPath}_${size}`;
    fs.writeFileSync(thumbnailPath, thumbnail);
  }
});