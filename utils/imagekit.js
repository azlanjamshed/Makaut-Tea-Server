const path = require('path');
const crypto = require('crypto');
const ImageKit = require('imagekit');

/**
 * Checks whether valid ImageKit credentials are configured in the environment.
 */
const isImageKitConfigured = () => {
  const pub = process.env.IMAGEKIT_PUBLIC_KEY;
  const priv = process.env.IMAGEKIT_PRIVATE_KEY;
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  return Boolean(
    pub &&
    priv &&
    endpoint &&
    !pub.includes('your_') &&
    !priv.includes('your_') &&
    !endpoint.includes('your_')
  );
};

let imagekitInstance = null;

const getImageKitClient = () => {
  if (!isImageKitConfigured()) {
    throw new Error('ImageKit is not configured');
  }

  if (!imagekitInstance) {
    imagekitInstance = new ImageKit({
      publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
      privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
      urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
    });
  }

  return imagekitInstance;
};

/**
 * Upload image directly to ImageKit.
 *
 * Pre-transforms before storage:
 * - resized to max 1600px width (w-1600)
 * - compressed to quality 80 (q-80)
 *
 * @param {Object} file - multer req.file
 * @param {string} folder - ImageKit folder (e.g. '/rants', '/avatars')
 * @returns {Promise<string>} ImageKit CDN URL
 */
const uploadImage = async (file, folder = '/rants') => {
  if (!file || !file.buffer) {
    return '';
  }

  const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
  const uniqueSuffix = crypto.randomBytes(16).toString('hex');
  const fileName = `${Date.now()}-${uniqueSuffix}${ext}`;

  const imagekit = getImageKitClient();

  try {
    const response = await imagekit.upload({
      file: file.buffer,
      fileName,
      folder,
      useUniqueFileName: true,
      // ImageKit pre-transformation resizes and compresses BEFORE saving to storage
      transformation: {
        pre: 'w-1600,q-80',
      },
    });

    return response.url;
  } catch (err) {
    console.error('ImageKit upload error:', err);
    const error = new Error(`Image upload failed: ${err.message || err}`);
    error.status = 502;
    throw error;
  }
};

module.exports = {
  isImageKitConfigured,
  getImageKitClient,
  uploadImage,
};