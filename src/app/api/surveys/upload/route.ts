import { NextResponse } from 'next/server';
import { uploadFileToDrive } from '@/lib/driveHelper';

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
