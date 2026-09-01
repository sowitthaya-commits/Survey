import { NextResponse, after } from 'next/server';
import { db } from '@/db';
import { surveys, salesPersons } from '@/db/schema';
import { eq, like, or } from 'drizzle-orm';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { uploadFileToDrive } from '@/lib/driveHelper';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

// GET all surveys or search
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const includeDeleted = searchParams.get('includeDeleted') === 'true';

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

    // กรองไม่เอางานที่ถูกลบสำหรับหน้า Dashboard ปกติ (เว้นแต่จะระบุ includeDeleted=true สำหรับ Gallery)
    if (!includeDeleted) {
      results = results.filter(r => r.status !== 'deleted');
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

    // ACTION: SYNC / RECOVER URLS DIRECTLY FROM GOOGLE DRIVE
    if (body.action === 'syncDrive') {
      const { id, projectName, customerName } = body;
      if (!id) {
        return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
      }

      const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
      if (scriptUrl) {
        try {
          console.log(`Syncing report URLs from Google Drive for project: ${projectName}...`);
          const res = await fetch(scriptUrl, {
            method: 'POST',
            redirect: 'follow',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'findReport',
              projectName: projectName,
              customerName: customerName
            })
          });

          if (res.ok) {
            const data = await res.json();
            if (data.success && (data.docUrl || data.pdfUrl)) {
              await db.update(surveys)
                .set({
                  docUrl: data.docUrl || null,
                  pdfUrl: data.pdfUrl || null,
                  status: 'completed',
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(surveys.id, id));

              return NextResponse.json({
                success: true,
                found: true,
                docUrl: data.docUrl,
                pdfUrl: data.pdfUrl,
                status: 'completed'
              });
            }
          }
        } catch (syncErr) {
          console.error('Error querying Google Drive for report:', syncErr);
        }
      }

      return NextResponse.json({
        success: false,
        message: 'Could not find report files on Google Drive'
      });
    }

    const { id, roomsData, existingImages, salesPersonName, generateReport, ...surveyData } = body;

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
          img.originalImage = await uploadFileToDrive(img.originalImage, id, `existing_step${img.step}_orig`, surveyData.projectName, surveyData.customerName);
        }
        if (img.annotatedImage && img.annotatedImage.startsWith('data:image')) {
          img.annotatedImage = await uploadFileToDrive(img.annotatedImage, id, `existing_step${img.step}_anno`, surveyData.projectName, surveyData.customerName);
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
              img.originalImage = await uploadFileToDrive(img.originalImage, id, `room_${room.id}_step${img.step}_orig`, surveyData.projectName, surveyData.customerName);
            }
            if (img.annotatedImage && img.annotatedImage.startsWith('data:image')) {
              img.annotatedImage = await uploadFileToDrive(img.annotatedImage, id, `room_${room.id}_step${img.step}_anno`, surveyData.projectName, surveyData.customerName);
            }
          }
        }
      }
    }
    const roomsDataString = JSON.stringify(rooms);

    const existing = await db.select().from(surveys).where(eq(surveys.id, id)).get();

    // Determine if we should generate/recreate the Google Sheets report
    const shouldGenerateReport = generateReport === true || (!existing && surveyData.status === 'pending_sync');
    const targetStatus = shouldGenerateReport ? 'generating' : (surveyData.status || existing?.status || 'completed');
    // When generating a new report, ALWAYS reset docUrl and pdfUrl to null so old links are removed!
    const docUrl: string | null = shouldGenerateReport ? null : (existing?.docUrl || null);
    const pdfUrl: string | null = shouldGenerateReport ? null : (existing?.pdfUrl || null);

    // 1. Save survey data to DB immediately so HTTP response is instant (< 1s) - completely prevents 504 Timeout!
    if (existing) {
      await db.update(surveys)
        .set({
          ...surveyData,
          salesPersonId: spId,
          existingImages: existingImagesString,
          roomsData: roomsDataString,
          docUrl: docUrl,
          pdfUrl: pdfUrl,
          updatedAt: now,
          status: targetStatus,
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
          docUrl: docUrl,
          pdfUrl: pdfUrl,
          createdAt: now,
          updatedAt: now,
          status: targetStatus,
        });
    }

    // 2. Trigger Google Apps Script report creation in background (Non-blocking)
    if (shouldGenerateReport) {
      const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
      if (scriptUrl) {
        console.log('Triggering Google Apps Script Web App to create report in background...');
        fetch(scriptUrl, {
          method: 'POST',
          redirect: 'follow',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'createReport',
            oldDocUrl: existing?.docUrl || null,
            oldPdfUrl: existing?.pdfUrl || null,
            projectName: surveyData.projectName || body.projectName,
            customerName: surveyData.customerName || body.customerName,
            budget: surveyData.budget || body.budget,
            salesPersonName: salesPersonName || body.salesPersonName,
            surveyDate: surveyData.surveyDate || body.surveyDate,
            requestDate: surveyData.requestDate || body.requestDate,
            quotationDeadline: surveyData.quotationDeadline || body.quotationDeadline,
            contactName: surveyData.contactName || body.contactName,
            contactPhone: surveyData.contactPhone || body.contactPhone,
            locationAddress: surveyData.locationAddress || body.locationAddress,
            locationLat: surveyData.locationLat || body.locationLat,
            locationLng: surveyData.locationLng || body.locationLng,
            roomsData: rooms,
            existingImages: existingImagesList,
            id: id
          })
        }).then(async (res) => {
          if (res.ok) {
            const data = await res.json();
            if (data.success && (data.docUrl || data.pdfUrl)) {
              await db.update(surveys)
                .set({
                  docUrl: data.docUrl || null,
                  pdfUrl: data.pdfUrl || null,
                  status: 'completed',
                  updatedAt: new Date().toISOString(),
                })
                .where(eq(surveys.id, id));
              console.log('Background: Successfully saved docUrl/pdfUrl from Apps Script into DB');
            }
          }
        }).catch((err) => {
          console.warn('Background createReport fetch warning (handled via polling):', err);
        });
      }
    }

    return NextResponse.json({
      success: true,
      surveyId: id,
      status: targetStatus,
      docUrl: docUrl,
      pdfUrl: pdfUrl
    });
  } catch (error: any) {
    console.error('Error saving survey:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Soft delete survey to preserve photos for Gallery, or permanent delete if specified
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const permanent = searchParams.get('permanent') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    if (permanent) {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', id);
      if (fs.existsSync(uploadDir)) {
        fs.rmSync(uploadDir, { recursive: true, force: true });
      }

      const result = await db.delete(surveys).where(eq(surveys.id, id)).run();
      const affected = (result as any).rowsAffected !== undefined ? (result as any).rowsAffected : (result as any).changes;

      if (affected === 0) {
        return NextResponse.json({ error: 'Survey not found' }, { status: 404 });
      }

      return NextResponse.json({ success: true, permanent: true });
    } else {
      // Soft Delete: ซ่อนออกจากแดชบอร์ด แต่ยังคงรูปภาพและข้อมูลไว้ให้ดูในคลังรูปภาพและให้ Admin กู้คืนได้
      await db.update(surveys).set({
        status: 'deleted',
        updatedAt: new Date().toISOString()
      }).where(eq(surveys.id, id)).run();

      return NextResponse.json({ success: true, softDeleted: true });
    }
  } catch (error: any) {
    console.error('Error deleting survey:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT: Restore a deleted survey back to active/synced status
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const { id, action } = body;

    if (!id) {
      return NextResponse.json({ error: 'Survey ID is required' }, { status: 400 });
    }

    if (action === 'restore') {
      await db.update(surveys).set({
        status: 'synced',
        updatedAt: new Date().toISOString()
      }).where(eq(surveys.id, id)).run();

      return NextResponse.json({ success: true, message: 'กู้คืนโครงการสำเร็จแล้ว' });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Error restoring survey:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
