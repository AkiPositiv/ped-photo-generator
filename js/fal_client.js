let _fal = null;

async function getFal() {
  if (!_fal) {
    const mod = await import('https://esm.sh/@fal-ai/client');
    _fal = mod.fal;
  }
  return _fal;
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
export async function uploadFacePhotos(files, apiKey) {
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
export async function generatePhoto(apiKey, imageArchiveUrl, prompt) {
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
