import { NextResponse } from 'next/server';
import { db } from '@/db';
import { surveys, salesPersons } from '@/db/schema';
import { eq, like, or } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileToDrive } from '@/lib/driveHelper';

// GET all surveys or search
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');

    let query = db.select({
      id: surveys.id,
      projectName: surveys.projectName,
      customerName: surveys.customerName,
      salesPersonName: salesPersons.name,
      salesPersonId: surveys.salesPersonId,
      status: surveys.status,
      docUrl: surveys.docUrl,
      pdfUrl: surveys.pdfUrl,
      createdAt: surveys.createdAt,
      updatedAt: surveys.updatedAt,
      requestDate: surveys.requestDate,
      locationLat: surveys.locationLat,
      locationLng: surveys.locationLng,
      locationAddress: surveys.locationAddress,
      quotationDeadline: surveys.quotationDeadline,
      budget: surveys.budget,
      existingImages: surveys.existingImages,
      contactName: surveys.contactName,
      contactPhone: surveys.contactPhone,
      surveyDate: surveys.surveyDate,
      roomsData: surveys.roomsData,
    })
    .from(surveys)
    .leftJoin(salesPersons, eq(surveys.salesPersonId, salesPersons.id));

    let results;
    if (search) {
      results = await query.where(
        or(
          like(surveys.projectName, `%${search}%`),
          like(surveys.customerName, `%${search}%`)
        )
      );
    } else {
      results = await query;
    }

    const parsedResults = results.map(row => ({
      ...row,
      existingImages: row.existingImages ? JSON.parse(row.existingImages) : [],
      roomsData: row.roomsData ? JSON.parse(row.roomsData) : [],
    }));

    parsedResults.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());

    return NextResponse.json(parsedResults);
  } catch (error: any) {
    console.error('Error fetching surveys:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create or Update Survey + Sync
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { id, roomsData, existingImages, salesPersonName, ...surveyData } = body;

    if (!id) {
      return NextResponse.json({ error: 'Survey ID (UUID) is required' }, { status: 400 });
    }

    const now = new Date().toISOString();

    // Find or create sales person record by name
    let spId = surveyData.salesPersonId;
    if (salesPersonName) {
      let sp = await db.select().from(salesPersons).where(eq(salesPersons.name, salesPersonName)).get();
      if (!sp) {
        await db.insert(salesPersons).values({
          name: salesPersonName,
          email: null,
          phone: null
        }).run();
        sp = await db.select().from(salesPersons).where(eq(salesPersons.name, salesPersonName)).get();
      }
      if (sp) {
        spId = sp.id;
      }
    }

    // 1. Process project-wide existing images (Upload to Google Drive)
    let existingImagesList = [];
    if (existingImages) {
      existingImagesList = typeof existingImages === 'string' ? JSON.parse(existingImages) : existingImages;
      for (const img of existingImagesList) {
        if (img.originalImage && img.originalImage.startsWith('data:image')) {
          img.originalImage = await uploadFileToDrive(img.originalImage, id, `existing_step${img.step}_orig`);
        }
        if (img.annotatedImage && img.annotatedImage.startsWith('data:image')) {
          img.annotatedImage = await uploadFileToDrive(img.annotatedImage, id, `existing_step${img.step}_anno`);
        }
      }
    }
    const existingImagesString = JSON.stringify(existingImagesList);

    // 2. Process and save images inside the roomsData list (Upload to Google Drive)
    let rooms = [];
    if (roomsData) {
      rooms = typeof roomsData === 'string' ? JSON.parse(roomsData) : roomsData;
      for (const room of rooms) {
        if (room.images && Array.isArray(room.images)) {
          for (const img of room.images) {
            if (img.originalImage && img.originalImage.startsWith('data:image')) {
              img.originalImage = await uploadFileToDrive(img.originalImage, id, `room_${room.id}_step${img.step}_orig`);
            }
            if (img.annotatedImage && img.annotatedImage.startsWith('data:image')) {
              img.annotatedImage = await uploadFileToDrive(img.annotatedImage, id, `room_${room.id}_step${img.step}_anno`);
            }
          }
        }
      }
    }
    const roomsDataString = JSON.stringify(rooms);

    const existing = await db.select().from(surveys).where(eq(surveys.id, id)).get();

    if (existing) {
      await db.update(surveys)
        .set({
          ...surveyData,
          salesPersonId: spId,
          existingImages: existingImagesString,
          roomsData: roomsDataString,
          updatedAt: now,
        })
        .where(eq(surveys.id, id));
    } else {
      await db.insert(surveys)
        .values({
          id,
          ...surveyData,
          salesPersonId: spId,
          existingImages: existingImagesString,
          roomsData: roomsDataString,
          createdAt: now,
          updatedAt: now,
          status: 'generating',
        });
    }

    // Google Docs Folder mapping: 1UkCIccul_XH6o1wQ7orjrJc0ozrBa-ws
    const mockDocId = uuidv4().substring(0, 16);
    // Directly target the folder via link (in real scripts, Apps Script places it there)
    const docUrl = `https://docs.google.com/document/d/${mockDocId}/edit?usp=drivesdk`;
    const pdfUrl = `/uploads/${id}/survey_report_${id.substring(0, 8)}.pdf`;

    try {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', id);
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const pdfPath = path.join(uploadDir, `survey_report_${id.substring(0, 8)}.pdf`);
      fs.writeFileSync(pdfPath, `%PDF-1.4\n% MOCKED SURVEY REPORT FOR ${surveyData.projectName}\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 50 >>\nstream\nBT /F1 12 Tf 70 700 Td (Mock Survey PDF Report for Multi-Room Layout) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000062 00000 n\n0000000119 00000 n\n0000000216 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n315\n%%EOF`);
    } catch (fsErr) {
      console.warn('Warning: Could not write mock PDF to local read-only filesystem:', fsErr);
    }

    // Update survey with URLs and completed status
    await db.update(surveys)
      .set({
        docUrl,
        pdfUrl,
        status: 'completed',
        updatedAt: new Date().toISOString(),
      })
      .where(eq(surveys.id, id));

    return NextResponse.json({
      success: true,
      surveyId: id,
      docUrl,
      pdfUrl,
      status: 'completed'
    });
  } catch (error: any) {
    console.error('Error saving survey:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE a survey and its uploaded files
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', id);
    if (fs.existsSync(uploadDir)) {
      fs.rmSync(uploadDir, { recursive: true, force: true });
    }

    const result = await db.delete(surveys).where(eq(surveys.id, id)).run();
    const affected = (result as any).rowsAffected !== undefined ? (result as any).rowsAffected : (result as any).changes;

    if (affected === 0) {
      return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting survey:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
