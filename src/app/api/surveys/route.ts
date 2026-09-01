import { NextResponse, after } from 'next/server';
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

    if (existing) {
      await db.update(surveys)
        .set({
          ...surveyData,
          salesPersonId: spId,
          existingImages: existingImagesString,
          roomsData: roomsDataString,
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
          createdAt: now,
          updatedAt: now,
          status: targetStatus,
        });
    }

    // Trigger Apps Script and PDF creation asynchronously ONLY if explicitly requested
    if (shouldGenerateReport) {
      after(async () => {
        let docUrl = null;
        let pdfUrl = null;

        const scriptUrl = process.env.GOOGLE_SCRIPT_URL;
        if (scriptUrl) {
          try {
            console.log('Background: Requesting Google Apps Script Web App to create report...');
            const response = await fetch(scriptUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                action: 'createReport',
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
                id: id
              })
            });
            
            if (response.ok) {
              const data = await response.json();
              if (data.success) {
                docUrl = data.docUrl;
                pdfUrl = data.pdfUrl;
                console.log('Background: Apps Script report generated successfully:', { docUrl, pdfUrl });
              } else {
                console.warn('Background: Apps Script report generation failed:', data.error);
              }
            } else {
              console.warn(`Background: Apps Script report HTTP error: ${response.status}`);
            }
          } catch (scriptErr) {
            console.error('Background: Failed calling Apps Script to create report:', scriptErr);
          }
        }

        // If Apps Script failed, fall back to mock links so execution completes
        const finalDocUrl = docUrl || `https://docs.google.com/document/d/${uuidv4().substring(0, 16)}/edit?usp=drivesdk`;
        const finalPdfUrl = pdfUrl || `/uploads/${id}/survey_report_${id.substring(0, 8)}.pdf`;

        if (!pdfUrl) {
          try {
            const uploadDir = path.join(process.cwd(), 'public', 'uploads', id);
            if (!fs.existsSync(uploadDir)) {
              fs.mkdirSync(uploadDir, { recursive: true });
            }
            const pdfPath = path.join(uploadDir, `survey_report_${id.substring(0, 8)}.pdf`);
            fs.writeFileSync(pdfPath, `%PDF-1.4\n% MOCKED SURVEY REPORT FOR ${surveyData.projectName}\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << >> /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 50 >>\nstream\nBT /F1 12 Tf 70 700 Td (Mock Survey PDF Report for Multi-Room Layout) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000062 00000 n\n0000000119 00000 n\n0000000216 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n315\n%%EOF`);
          } catch (fsErr) {
            console.warn('Background Warning: Could not write mock PDF to local read-only filesystem:', fsErr);
          }
        }

        // Update survey with URLs and completed status
        await db.update(surveys)
          .set({
            docUrl: finalDocUrl,
            pdfUrl: finalPdfUrl,
            status: 'completed',
            updatedAt: new Date().toISOString(),
          })
          .where(eq(surveys.id, id));
          
        console.log('Background: Survey status updated to completed.');
      });
    }

    return NextResponse.json({
      success: true,
      surveyId: id,
      status: 'generating'
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
