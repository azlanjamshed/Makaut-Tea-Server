const assert = require('assert');
const ImageKit = require('imagekit');
const imagekitUtil = require('../utils/imagekit');

async function runImageKitTests() {
  console.log('=== STARTING IMAGEKIT INTEGRATION TESTS ===\n');

  // Test 1: Detected as not configured with placeholders or missing keys
  delete process.env.IMAGEKIT_PUBLIC_KEY;
  delete process.env.IMAGEKIT_PRIVATE_KEY;
  delete process.env.IMAGEKIT_URL_ENDPOINT;
  assert.strictEqual(imagekitUtil.isImageKitConfigured(), false);
  console.log('  ✅ PASS: Missing keys detected as not configured');

  process.env.IMAGEKIT_PUBLIC_KEY = 'your_imagekit_public_key';
  process.env.IMAGEKIT_PRIVATE_KEY = 'your_imagekit_private_key';
  process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/your_imagekit_id';
  assert.strictEqual(imagekitUtil.isImageKitConfigured(), false);
  console.log('  ✅ PASS: Placeholder keys detected as not configured');

  // Test 2: When real keys are set, isImageKitConfigured returns true
  process.env.IMAGEKIT_PUBLIC_KEY = 'public_live_key_xyz';
  process.env.IMAGEKIT_PRIVATE_KEY = 'private_live_key_xyz';
  process.env.IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/college_demo';
  assert.strictEqual(imagekitUtil.isImageKitConfigured(), true);
  console.log('  ✅ PASS: Valid keys detected as configured');

  // Test 3: Upload calls ImageKit client and returns CDN URL
  const ikClient = imagekitUtil.getImageKitClient();
  let uploadedOpts = null;
  ikClient.upload = async (opts) => {
    uploadedOpts = opts;
    return {
      fileId: 'ik_file_98765',
      name: opts.fileName,
      url: `${process.env.IMAGEKIT_URL_ENDPOINT}${opts.folder}/${opts.fileName}`,
    };
  };

  const sampleFile = {
    originalname: 'avatar.png',
    buffer: Buffer.from('test binary content'),
  };

  const cdnUrl = await imagekitUtil.uploadImage(sampleFile, '/avatars');
  assert.strictEqual(uploadedOpts.folder, '/avatars');
  assert.ok(uploadedOpts.useUniqueFileName);
  assert.strictEqual(uploadedOpts.file, sampleFile.buffer);
  assert.ok(cdnUrl.startsWith('https://ik.imagekit.io/college_demo/avatars/'));
  console.log('  ✅ PASS: uploadImage uploads buffer and returns ImageKit CDN URL:', cdnUrl);

  // Test 4: Post image upload uses /posts folder
  const postFile = {
    originalname: 'rant_photo.jpg',
    buffer: Buffer.from('photo buffer'),
  };
  const postCdnUrl = await imagekitUtil.uploadImage(postFile, '/posts');
  assert.strictEqual(uploadedOpts.folder, '/posts');
  assert.ok(postCdnUrl.startsWith('https://ik.imagekit.io/college_demo/posts/'));
  console.log('  ✅ PASS: Post uploads route to /posts folder:', postCdnUrl);

  // Test 5: ImageKit failure bubbles up with 502 status
  ikClient.upload = async () => {
    throw new Error('API Rate Limit Exceeded');
  };

  let caughtError = null;
  try {
    await imagekitUtil.uploadImage(sampleFile, '/avatars');
  } catch (err) {
    caughtError = err;
  }
  assert.ok(caughtError);
  assert.strictEqual(caughtError.status, 502);
  assert.ok(caughtError.message.includes('API Rate Limit Exceeded'));
  console.log('  ✅ PASS: ImageKit API error wrapped with status 502');

  console.log('\n========================================');
  console.log('ALL IMAGEKIT TESTS PASSED (5/5)');
  console.log('========================================\n');
}

runImageKitTests().catch((err) => {
  console.error('ImageKit test failed:', err);
  process.exit(1);
});
