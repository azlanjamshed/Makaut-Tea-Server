const assert = require("assert");
const imagekitUtil = require("../utils/imagekit");

async function runImageKitTests() {
  console.log("=== STARTING IMAGEKIT INTEGRATION TESTS ===\n");

  // Save the original environment variables
  const originalEnv = {
    publicKey: process.env.IMAGEKIT_PUBLIC_KEY,
    privateKey: process.env.IMAGEKIT_PRIVATE_KEY,
    endpoint: process.env.IMAGEKIT_URL_ENDPOINT,
  };

  try {
    // ============================================================
    // TEST 1: Missing ImageKit configuration
    // ============================================================

    delete process.env.IMAGEKIT_PUBLIC_KEY;
    delete process.env.IMAGEKIT_PRIVATE_KEY;
    delete process.env.IMAGEKIT_URL_ENDPOINT;

    assert.strictEqual(imagekitUtil.isImageKitConfigured(), false);

    console.log("  ✅ PASS: Missing keys detected as not configured");

    // ============================================================
    // TEST 2: Placeholder ImageKit configuration
    // ============================================================

    process.env.IMAGEKIT_PUBLIC_KEY = "your_imagekit_public_key";

    process.env.IMAGEKIT_PRIVATE_KEY = "your_imagekit_private_key";

    process.env.IMAGEKIT_URL_ENDPOINT =
      "https://ik.imagekit.io/your_imagekit_id";

    assert.strictEqual(imagekitUtil.isImageKitConfigured(), false);

    console.log("  ✅ PASS: Placeholder keys detected as not configured");

    // ============================================================
    // TEST 3: Valid-looking ImageKit configuration
    // ============================================================

    // These are intentionally fake values.
    // NEVER put real ImageKit private keys inside this test file.
    process.env.IMAGEKIT_PUBLIC_KEY = "public_live_key_xyz";

    process.env.IMAGEKIT_PRIVATE_KEY = "private_live_key_xyz";

    process.env.IMAGEKIT_URL_ENDPOINT = "https://ik.imagekit.io/college_demo";

    assert.strictEqual(imagekitUtil.isImageKitConfigured(), true);

    console.log("  ✅ PASS: Valid-looking keys detected as configured");

    // ============================================================
    // TEST 4: Image upload
    // ============================================================

    const ikClient = imagekitUtil.getImageKitClient();

    let uploadedOpts = null;

    // Mock ImageKit upload.
    // This prevents the test from making a real API request.
    ikClient.upload = async (opts) => {
      uploadedOpts = opts;

      return {
        fileId: "ik_file_98765",
        name: opts.fileName,
        url: `${process.env.IMAGEKIT_URL_ENDPOINT}${opts.folder}/${opts.fileName}`,
      };
    };

    const sampleFile = {
      originalname: "avatar.png",
      buffer: Buffer.from("test binary content"),
    };

    const cdnUrl = await imagekitUtil.uploadImage(sampleFile, "/avatars");

    assert.ok(uploadedOpts);

    assert.strictEqual(uploadedOpts.folder, "/avatars");

    assert.ok(uploadedOpts.useUniqueFileName);

    assert.strictEqual(uploadedOpts.file, sampleFile.buffer);

    assert.ok(
      cdnUrl.startsWith("https://ik.imagekit.io/college_demo/avatars/"),
    );

    console.log(
      "  ✅ PASS: uploadImage uploads buffer and returns ImageKit CDN URL:",
      cdnUrl,
    );

    // ============================================================
    // TEST 5: Post image upload
    // ============================================================

    const postFile = {
      originalname: "rant_photo.jpg",
      buffer: Buffer.from("photo buffer"),
    };

    const postCdnUrl = await imagekitUtil.uploadImage(postFile, "/posts");

    assert.strictEqual(uploadedOpts.folder, "/posts");

    assert.ok(
      postCdnUrl.startsWith("https://ik.imagekit.io/college_demo/posts/"),
    );

    console.log("  ✅ PASS: Post uploads route to /posts folder:", postCdnUrl);

    // ============================================================
    // TEST 6: ImageKit API failure
    // ============================================================

    ikClient.upload = async () => {
      throw new Error("API Rate Limit Exceeded");
    };

    let caughtError = null;

    try {
      await imagekitUtil.uploadImage(sampleFile, "/avatars");
    } catch (err) {
      caughtError = err;
    }

    assert.ok(caughtError, "Expected uploadImage() to throw an error");

    assert.strictEqual(caughtError.status, 502);

    assert.ok(caughtError.message.includes("API Rate Limit Exceeded"));

    console.log("  ✅ PASS: ImageKit API error wrapped with status 502");

    // ============================================================
    // SUCCESS
    // ============================================================

    console.log("\n========================================");
    console.log("ALL IMAGEKIT TESTS PASSED (6/6)");
    console.log("========================================\n");
  } finally {
    // ============================================================
    // RESTORE ORIGINAL ENVIRONMENT
    // ============================================================

    if (originalEnv.publicKey === undefined) {
      delete process.env.IMAGEKIT_PUBLIC_KEY;
    } else {
      process.env.IMAGEKIT_PUBLIC_KEY = originalEnv.publicKey;
    }

    if (originalEnv.privateKey === undefined) {
      delete process.env.IMAGEKIT_PRIVATE_KEY;
    } else {
      process.env.IMAGEKIT_PRIVATE_KEY = originalEnv.privateKey;
    }

    if (originalEnv.endpoint === undefined) {
      delete process.env.IMAGEKIT_URL_ENDPOINT;
    } else {
      process.env.IMAGEKIT_URL_ENDPOINT = originalEnv.endpoint;
    }
  }
}

runImageKitTests().catch((err) => {
  console.error("\n❌ ImageKit test failed:");
  console.error(err);
  process.exit(1);
});
