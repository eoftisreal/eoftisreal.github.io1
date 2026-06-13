const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { nanoid } = require('nanoid');
const env = require('../config/env');

let s3Client = null;

if (env.r2AccessKeyId && env.r2SecretAccessKey && env.r2Endpoint) {
  s3Client = new S3Client({
    region: 'auto',
    endpoint: env.r2Endpoint,
    credentials: {
      accessKeyId: env.r2AccessKeyId,
      secretAccessKey: env.r2SecretAccessKey,
    },
  });
}

function normalizeObjectKey(objectKey) {
  return String(objectKey || '')
    .trim()
    .replace(/^\/+/, '')
    .replace(/\/+/g, '/');
}

function getR2BaseUrl() {
  if (env.r2PublicUrl) {
    return env.r2PublicUrl.replace(/\/$/, '');
  }

  return '';
}

function isR2Configured() {
  return Boolean(getR2BaseUrl());
}

function getObjectUrl(objectKey) {
  const key = normalizeObjectKey(objectKey);
  if (!key) {
    throw new Error('R2 object key is required');
  }

  const baseUrl = getR2BaseUrl();
  if (!baseUrl) {
    throw new Error('Cloudflare R2 is not configured');
  }

  return `${baseUrl}/${encodeURI(key)}`;
}

async function uploadToR2(fileBuffer, mimeType, originalName, folder = 'uploads') {
  if (!s3Client || !env.r2BucketName) {
    throw new Error('Cloudflare R2 is not properly configured for uploading');
  }

  const extension = originalName.split('.').pop() || '';
  // Ensure the folder path is clean (no leading slash, has a trailing slash if not empty)
  let cleanFolder = normalizeObjectKey(folder);
  if (cleanFolder && !cleanFolder.endsWith('/')) {
    cleanFolder += '/';
  }

  const key = `${cleanFolder}${nanoid()}.${extension}`;

  const command = new PutObjectCommand({
    Bucket: env.r2BucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mimeType,
  });

  await s3Client.send(command);

  return key;
}

module.exports = {
  normalizeObjectKey,
  getR2BaseUrl,
  isR2Configured,
  getObjectUrl,
  uploadToR2,
};
