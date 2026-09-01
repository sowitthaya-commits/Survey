import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import os from 'os';

const IMAGE_FOLDER_ID = '133P6jxYlZ0ixXPhuYwFQ8tjbNCATEnFT'; // User's image folder ID

// Initialize Google Auth client
function getGoogleAuthClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (!email || !privateKey) {
    return null;
  }

  // Format private key (replace literal \n with newlines)
  const formattedKey = privateKey.replace(/\\n/g, '\n');

  return new google.auth.JWT({
    email,
    key: formattedKey,
    scopes: ['https://www.googleapis.com/auth/drive']
  });
}

/**
 * Uploads a base64 image or file to Google Drive.
 * Falls back to local filesystem storage if Google Credentials are not configured.
 */
export async function uploadFileToDrive(
  base64Str: string,
  surveyId: string,
  fileNamePrefix: string,
  projectName?: string,
  customerName?: string
): Promise<string> {
  const auth = getGoogleAuthClient();

  // Extract base64 format info
  const matches = base64Str.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
  let ext = 'jpg';
  let cleanBase64 = base64Str;

  if (matches && matches.length === 3) {
    ext = matches[1] === 'png' ? 'png' : 'jpg';
    cleanBase64 = matches[2];
  }

  const fileName = `${fileNamePrefix}_${uuidv4().substring(0, 8)}.${ext}`;
  const buffer = Buffer.from(cleanBase64, 'base64');

  // Check if Google Apps Script URL is set (Bypasses Google Cloud Console setup!)
  const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
  if (scriptUrl) {
    try {
      console.log(`Uploading ${fileName} to Google Drive via Apps Script Web App...`);
      const response = await fetch(scriptUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'uploadImage',
          imageBase64: base64Str,
          fileName: fileName,
          projectName: projectName || '',
          customerName: customerName || ''
        })
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.url) {
          console.log(`Apps Script upload succeeded: ${data.url}`);
          return data.url;
        } else {
          console.warn(`Apps Script upload failed:`, data.error);
        }
      } else {
        console.warn(`Apps Script HTTP error: ${response.status}`);
      }
    } catch (scriptErr) {
      console.error('Failed uploading image via Google Apps Script Web App:', scriptErr);
    }
  }

  // Fallback to local storage if credentials are not provided
  if (!auth) {
    console.log('Google credentials not set. Falling back to local storage.');
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', surveyId);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localPath = path.join(uploadDir, fileName);
      fs.writeFileSync(localPath, buffer);
      return `/uploads/${surveyId}/${fileName}`;
    } catch (writeErr) {
      console.warn('Failed to write locally (read-only filesystem):', writeErr);
      return base64Str; // Return base64 directly so the UI still displays it
    }
  }

  try {
    const drive = google.drive({ version: 'v3', auth });

    // Temp file path in writeable OS temporary folder (prevents serverless write errors)
    const tempDir = os.tmpdir();
    const tempFilePath = path.join(tempDir, fileName);
    fs.writeFileSync(tempFilePath, buffer);

    console.log(`Uploading ${fileName} to Google Drive...`);
    const fileMetadata = {
      name: fileName,
      parents: [IMAGE_FOLDER_ID]
    };
    const media = {
      mimeType: ext === 'png' ? 'image/png' : 'image/jpeg',
      body: fs.createReadStream(tempFilePath)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink',
      supportsAllDrives: true
    });

    // Delete temp file
    if (fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
      } catch (unlinkErr) {
        console.warn('Failed to clean up temp file:', unlinkErr);
      }
    }

    const fileId = response.data.id;
    if (!fileId) {
      throw new Error('Google Drive upload succeeded but failed to return a file ID');
    }

    // Set permission to anyone with the link can view (important for displaying in browser)
    try {
      await drive.permissions.create({
        fileId: fileId,
        requestBody: {
          role: 'reader',
          type: 'anyone'
        },
        supportsAllDrives: true
      });
    } catch (permError) {
      console.warn('Failed to set public view permissions:', permError);
    }

    // Return direct webContentLink (which is download link/embed Link) or webViewLink
    // The webContentLink allows direct image embedding in img tags
    // Direct embed link format: https://lh3.googleusercontent.com/d/{id} or drive.google.com/uc?id={id}
    return `https://lh3.googleusercontent.com/d/${fileId}`;
  } catch (error) {
    console.error('Error uploading file to Google Drive:', error);
    // If google drive upload fails, fall back to local as fallback safety
    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', surveyId);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const localPath = path.join(uploadDir, fileName);
      fs.writeFileSync(localPath, buffer);
      return `/uploads/${surveyId}/${fileName}`;
    } catch (writeErr) {
      console.warn('Failed to write locally during error fallback (read-only filesystem):', writeErr);
      return base64Str; // Return base64 directly so the UI still displays it
    }
  }
}
