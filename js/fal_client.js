let _fal = null;

async function getFal() {
  if (!_fal) {
    const mod = await import('https://esm.sh/@fal-ai/client');
    _fal = mod.fal;
  }
  return _fal;
}

/** Upload a single image file to Fal.ai storage, return URL. */
async function uploadSingleImage(file, apiKey) {
  const fal = await getFal();
  fal.config({ credentials: apiKey });
  return await fal.storage.upload(file);
}

/**
 * Composer mode 1: generate a scene from text description with teacher's face.
 * Zips the single face photo, runs PhotoMaker with the custom prompt.
 */
async function composerGenerateWithDesc(apiKey, faceFile, description) {
  const fal = await getFal();
  fal.config({ credentials: apiKey });

  const zip = new JSZip();
  zip.file(faceFile.name, faceFile);
  const blob = await zip.generateAsync({ type: 'blob' });
  const zipFile = new File([blob], 'face.zip', { type: 'application/zip' });
  const archiveUrl = await fal.storage.upload(zipFile);

  const prompt = `img, teacher, ${description}, realistic photography, professional lighting, 8k, highly detailed`;
  const result = await fal.run('fal-ai/photomaker', {
    input: {
      image_archive_url: archiveUrl,
      prompt,
      negative_prompt: 'cartoon, anime, blurry, low quality, deformed, watermark',
      style_name: 'Photographic (Default)',
      num_steps: 30,
      style_strength_ratio: 20,
      num_images: 1,
      guidance_scale: 5,
    },
  });
  if (!result.images || result.images.length === 0) throw new Error('Нет результата от PhotoMaker');
  return result.images[0].url;
}

/**
 * Composer mode 2: face swap — insert teacher's face into a sample photo.
 */
async function composerFaceSwap(apiKey, faceImageUrl, targetImageUrl) {
  const fal = await getFal();
  fal.config({ credentials: apiKey });
  const result = await fal.run('fal-ai/face-swap', {
    input: {
      source_image_url: faceImageUrl,
      target_image_url: targetImageUrl,
    },
  });
  const url = result?.image?.url || result?.images?.[0]?.url;
  if (!url) throw new Error('Нет результата от face-swap');
  return url;
}

/** Zip all face photo files into one blob. */
async function zipFiles(files) {
  const zip = new JSZip();
  for (const file of files) zip.file(file.name, file);
  return await zip.generateAsync({ type: 'blob' });
}

/**
 * Upload face reference photos to Fal.ai storage as a ZIP.
 * Returns the public URL of the uploaded ZIP.
 */
async function uploadFacePhotos(files, apiKey) {
  const fal = await getFal();
  fal.config({ credentials: apiKey });
  const blob = await zipFiles(files);
  const zipFile = new File([blob], 'faces.zip', { type: 'application/zip' });
  return await fal.storage.upload(zipFile);
}

/**
 * Generate one photo via fal-ai/photomaker.
 * Returns the URL of the generated image.
 */
async function generatePhoto(apiKey, imageArchiveUrl, prompt) {
  const fal = await getFal();
  fal.config({ credentials: apiKey });
  const result = await fal.run('fal-ai/photomaker', {
    input: {
      image_archive_url: imageArchiveUrl,
      prompt,
      negative_prompt: 'cartoon, anime, illustration, blurry, low quality, deformed, extra limbs, watermark',
      style_name: 'Photographic (Default)',
      num_steps: 30,
      style_strength_ratio: 20,
      num_images: 1,
      guidance_scale: 5,
    },
  });
  if (!result.images || result.images.length === 0) {
    throw new Error('No images returned from Fal.ai');
  }
  return result.images[0].url;
}
