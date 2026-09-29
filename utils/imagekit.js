// const path = require('path');
// const fs = require('fs');
// const crypto = require('crypto');
// const ImageKit = require('imagekit');

// const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// /**
//  * Returns true if all required ImageKit environment variables are present and not placeholders.
//  */
// const isImageKitConfigured = () => {
//   const pub = process.env.IMAGEKIT_PUBLIC_KEY;
//   const priv = process.env.IMAGEKIT_PRIVATE_KEY;
//   const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;

//   return (
//     Boolean(pub) &&
//     Boolean(priv) &&
//     Boolean(endpoint) &&
//     !pub.includes('your_') &&
//     !priv.includes('your_') &&
//     !endpoint.includes('your_')
//   );
// };

// let imagekitInstance = null;

// /**
//  * Initializes and returns an ImageKit instance if configured.
//  */
// const getImageKitClient = () => {
//   if (!isImageKitConfigured()) {
//     return null;
//   }

//   if (!imagekitInstance) {
//     imagekitInstance = new ImageKit({
//       publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
//       privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
//       urlEndpoint: process.env.IMAGEKIT_URL_ENDPOINT,
//     });
//   }

//   return imagekitInstance;
// };

// /**
//  * Uploads an image buffer from multer (req.file) to ImageKit.
//  * If ImageKit credentials are not configured, falls back to local /uploads storage.
//  *
//  * @param {Object} file - req.file object from multer (must have .buffer and .originalname)
//  * @param {string} [folder='/rants'] - target folder path in ImageKit
//  * @returns {Promise<string>} public URL of the uploaded image
//  */
// const uploadImage = async (file, folder = '/rants') => {
//   if (!file || !file.buffer) {
//     return '';
//   }

//   const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
//   const uniqueSuffix = crypto.randomBytes(16).toString('hex');
//   const fileName = `${Date.now()}-${uniqueSuffix}${ext}`;

//   const ik = getImageKitClient();
//   if (ik) {
//     try {
//       const response = await ik.upload({
//         file: file.buffer,
//         fileName,
//         folder,
//         useUniqueFileName: true,
//       });
//       return response.url;
//     } catch (err) {
//       const error = new Error(`ImageKit upload failed: ${err.message || err}`);
//       error.status = 502;
//       throw error;
//     }
//   }

//   // Graceful fallback to local disk storage if ImageKit credentials are not provided
//   if (!fs.existsSync(UPLOAD_DIR)) {
//     fs.mkdirSync(UPLOAD_DIR, { recursive: true });
//   }

//   const filePath = path.join(UPLOAD_DIR, fileName);
//   await fs.promises.writeFile(filePath, file.buffer);
//   return `/uploads/${fileName}`;
// };

// module.exports = {
//   isImageKitConfigured,
//   getImageKitClient,
//   uploadImage,
// };


const path = require("path");
const crypto = require("crypto");
const ImageKit = require("imagekit");

const isImageKitConfigured = () => {
  const pub = process.env.IMAGEKIT_PUBLIC_KEY;
  const priv = process.env.IMAGEKIT_PRIVATE_KEY;
  const endpoint = process.env.IMAGEKIT_URL_ENDPOINT;

  return Boolean(pub && priv && endpoint);
};

let imagekitInstance = null;

const getImageKitClient = () => {
  if (!isImageKitConfigured()) {
    throw new Error("ImageKit is not configured");
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
 * The image is:
 * - resized to max 1600px width
 * - compressed to quality 80
 * - uploaded directly to ImageKit
 *
 * @param {Object} file - multer req.file
 * @param {string} folder - ImageKit folder
 * @returns {Promise<string>} ImageKit URL
 */
const uploadImage = async (file, folder = "/rants") => {
  if (!file || !file.buffer) {
    return "";
  }

  const ext =
    path.extname(file.originalname || "").toLowerCase() || ".jpg";

  const uniqueSuffix = crypto.randomBytes(16).toString("hex");

  const fileName = `${Date.now()}-${uniqueSuffix}${ext}`;

  const imagekit = getImageKitClient();

  try {
    const response = await imagekit.upload({
      file: file.buffer,

      fileName,

      folder,

      useUniqueFileName: true,

      // ImageKit transforms the image BEFORE
      // storing it in the Media Library.
      transformation: {
        pre: "w-1600,q-80",
      },
    });

    return response.url;
  } catch (err) {
    console.error("ImageKit upload error:", err);

    const error = new Error(
      `Image upload failed: ${err.message || err}`
    );

    error.status = 502;

    throw error;
  }
};

module.exports = {
  isImageKitConfigured,
  getImageKitClient,
  uploadImage,
};