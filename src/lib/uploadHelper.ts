import { offlineDb } from './offlineDb';

/**
 * Helper to upload a single base64 image to the server API.
 */
async function uploadSingleBase64Image(
  base64Str: string,
  surveyId: string,
  fileNamePrefix: string
): Promise<string> {
  const response = await fetch('/api/surveys/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64Str,
      surveyId,
      fileNamePrefix,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload image segment: ${text}`);
  }

  const result = await response.json();
  if (result.success && result.url) {
    return result.url;
  } else {
    throw new Error(result.error || 'Failed to upload image to server');
  }
}

/**
 * Helper to compress a base64 image using HTML5 Canvas in the browser.
 */
function compressImage(base64Str: string, maxWidth = 1200, maxHeight = 900, quality = 0.7): Promise<string> {
  return new Promise((resolve) => {
    // If not a browser environment or already compressed/small, return as-is
    if (typeof window === 'undefined' || !base64Str.startsWith('data:image')) {
      resolve(base64Str);
      return;
    }

    const img = new Image();
    img.src = base64Str;
    img.onload = () => {
      let width = img.width;
      let height = img.height;

      // Calculate new dimensions keeping aspect ratio
      if (width > height) {
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
      } else {
        if (height > maxHeight) {
          width = Math.round((width * maxHeight) / height);
          height = maxHeight;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0, width, height);
        // Compress as jpeg with specified quality (usually jpeg format has much better compression ratio)
        const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
        resolve(compressedBase64);
      } else {
        resolve(base64Str);
      }
    };
    img.onerror = () => {
      resolve(base64Str);
    };
  });
}

/**
 * Scans a survey object for base64 images, uploads them one-by-one,
 * replaces base64 strings with Drive URLs, and saves the result to IndexedDB.
 */
export async function uploadSurveyBase64Images(survey: any): Promise<any> {
  const updatedSurvey = JSON.parse(JSON.stringify(survey)); // deep copy
  const id = updatedSurvey.id;

  const compress = async (base64: string): Promise<string> => {
    try {
      return await compressImage(base64, 1200, 900, 0.7);
    } catch (err) {
      console.warn('Compression failed, uploading original image instead:', err);
      return base64;
    }
  };

  // 1. Process project-wide existing images
  if (updatedSurvey.existingImages && Array.isArray(updatedSurvey.existingImages)) {
    for (const img of updatedSurvey.existingImages) {
      if (img.originalImage && img.originalImage.startsWith('data:image')) {
        const compressed = await compress(img.originalImage);
        img.originalImage = await uploadSingleBase64Image(compressed, id, `existing_step${img.step}_orig`);
      }
      if (img.annotatedImage && img.annotatedImage.startsWith('data:image')) {
        const compressed = await compress(img.annotatedImage);
        img.annotatedImage = await uploadSingleBase64Image(compressed, id, `existing_step${img.step}_anno`);
      }
    }
  }

  // 2. Process images inside roomsData
  if (updatedSurvey.roomsData && Array.isArray(updatedSurvey.roomsData)) {
    for (const room of updatedSurvey.roomsData) {
      if (room.images && Array.isArray(room.images)) {
        for (const img of room.images) {
          if (img.originalImage && img.originalImage.startsWith('data:image')) {
            const compressed = await compress(img.originalImage);
            img.originalImage = await uploadSingleBase64Image(compressed, id, `room_${room.id}_step${img.step}_orig`);
          }
          if (img.annotatedImage && img.annotatedImage.startsWith('data:image')) {
            const compressed = await compress(img.annotatedImage);
            img.annotatedImage = await uploadSingleBase64Image(compressed, id, `room_${room.id}_step${img.step}_anno`);
          }
        }
      }
    }
  }

  // Save the updated base64-free URLs back to IndexedDB
  await offlineDb.draftSurveys.put(updatedSurvey);

  return updatedSurvey;
}
