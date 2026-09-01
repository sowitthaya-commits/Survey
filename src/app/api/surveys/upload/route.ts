import { NextResponse } from 'next/server';
import { uploadFileToDrive, deleteFileFromDrive } from '@/lib/driveHelper';

export async function POST(request: Request) {
  try {
    const { base64Str, surveyId, fileNamePrefix, projectName, customerName } = await request.json();

    if (!base64Str || !surveyId || !fileNamePrefix) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const driveUrl = await uploadFileToDrive(base64Str, surveyId, fileNamePrefix, projectName, customerName);
    
    return NextResponse.json({ success: true, url: driveUrl });
  } catch (error: any) {
    console.error('Error in upload route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { fileUrl } = await request.json();
    if (!fileUrl) {
      return NextResponse.json({ error: 'fileUrl is required' }, { status: 400 });
    }

    const success = await deleteFileFromDrive(fileUrl);
    return NextResponse.json({ success });
  } catch (error: any) {
    console.error('Error in delete image route:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
