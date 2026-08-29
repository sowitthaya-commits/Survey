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
 * Scans a survey object for base64 images, uploads them one-by-one,
 * replaces base64 strings with Drive URLs, and saves the result to IndexedDB.
 */
export async function uploadSurveyBase64Images(survey: any): Promise<any> {
  const updatedSurvey = JSON.parse(JSON.stringify(survey)); // deep copy
  const id = updatedSurvey.id;

  // 1. Process project-wide existing images
  if (updatedSurvey.existingImages && Array.isArray(updatedSurvey.existingImages)) {
    for (const img of updatedSurvey.existingImages) {
      if (img.originalImage && img.originalImage.startsWith('data:image')) {
        img.originalImage = await uploadSingleBase64Image(img.originalImage, id, `existing_step${img.step}_orig`);
      }
      if (img.annotatedImage && img.annotatedImage.startsWith('data:image')) {
        img.annotatedImage = await uploadSingleBase64Image(img.annotatedImage, id, `existing_step${img.step}_anno`);
      }
    }
  }

  // 2. Process images inside roomsData
  if (updatedSurvey.roomsData && Array.isArray(updatedSurvey.roomsData)) {
    for (const room of updatedSurvey.roomsData) {
      if (room.images && Array.isArray(room.images)) {
        for (const img of room.images) {
          if (img.originalImage && img.originalImage.startsWith('data:image')) {
            img.originalImage = await uploadSingleBase64Image(img.originalImage, id, `room_${room.id}_step${img.step}_orig`);
          }
          if (img.annotatedImage && img.annotatedImage.startsWith('data:image')) {
            img.annotatedImage = await uploadSingleBase64Image(img.annotatedImage, id, `room_${room.id}_step${img.step}_anno`);
          }
        }
      }
    }
  }

  // Save the updated base64-free URLs back to IndexedDB
  await offlineDb.draftSurveys.put(updatedSurvey);

  return updatedSurvey;
}
