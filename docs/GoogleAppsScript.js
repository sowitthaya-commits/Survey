/**
 * Google Apps Script - SWS Survey System Core API
 * 
 * วิธีใช้งาน:
 * 1. เข้าไปที่เว็บ https://script.google.com ด้วยบัญชี Google ของท่าน
 * 2. สร้างโปรเจกต์ใหม่ (New Project) และนำโค้ดทั้งหมดในไฟล์นี้ไปวางแทนของเดิม
 * 3. กดเซฟโปรเจกต์
 * 4. กดปุ่ม "Deploy" (การทำให้ใช้งานได้) -> เลือก "New Deployment" (การทำให้ใช้งานได้ใหม่)
 * 5. เลือกประเภทเป็น "Web App" (เว็บแอป) โดยตั้งค่าดังนี้:
 *    - Execute as: Me (บัญชี Google ของท่านเอง)
 *    - Who has access: Anyone (ทุกคน - เพื่อให้เซิร์ฟเวอร์ Next.js สามารถส่งภาพเข้ามาได้)
 * 6. กด Deploy แล้วยินยอมสิทธิ์เข้าถึง (Authorize Access)
 * 7. คัดลอก "Web App URL" ที่ได้ (เช่น https://script.google.com/macros/s/.../exec)
 *    ไปป้อนใส่ในไฟล์ .env.local ช่อง GOOGLE_SCRIPT_URL
 */

// --- CONFIGURATION ---
const IMAGE_FOLDER_ID = '1b8IaUy9U1Ykd8IubEs0w_d206kXRoVHM'; // โฟลเดอร์เก็บรูปภาพ
const DOCUMENT_FOLDER_ID = '1UkCIccul_XH6o1wQ7orjrJc0ozrBa-ws'; // โฟลเดอร์เก็บเอกสารสรุป/Sheets
const TEMPLATE_DOC_ID = '1UkCIccul_XH6o1wQ7orjrJc0ozrBa-ws'; // สามารถใช้ไฟล์เดียวกันเป็น Template หรือกำหนด ID Google Doc Template ของท่าน

function doPost(e) {
  try {
    const postData = JSON.parse(e.postData.contents);
    const action = postData.action;

    // ACTION: UPLOAD IMAGE
    if (action === 'uploadImage') {
      const folder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
      const base64Data = postData.imageBase64;
      const fileName = postData.fileName || ('sws_image_' + new Date().getTime() + '.jpg');
      
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z-]+\/?[a-z-]+;base64,/, '');
      const decoded = Utilities.base64Decode(cleanBase64);
      const mimeType = base64Data.includes('image/png') ? 'image/png' : 'image/jpeg';
      const blob = Utilities.newBlob(decoded, mimeType, fileName);
      
      const file = folder.createFile(blob);
      
      // ตั้งค่าแชร์ให้ทุกคนเข้าดูได้ทางเว็บ
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        url: 'https://docs.google.com/uc?export=view&id=' + file.getId()
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION: CREATE REPORT DOC & PDF
    if (action === 'createReport') {
      const projectName = postData.projectName || 'ไม่ได้ระบุ';
      const customerName = postData.customerName || 'ไม่ได้ระบุ';
      const targetFolder = DriveApp.getFolderById(DOCUMENT_FOLDER_ID);
      
      // คัดลอกแบบฟอร์มเปล่าเพื่อเตรียมทำเอกสารใหม่
      // หมายเหตุ: ตรงนี้หากยังไม่มีไฟล์ Template จริง ระบบจะเขียนเป็นข้อความลง Text แทนชั่วคราว
      let docUrl = '';
      let pdfUrl = '';
      
      try {
        const templateFile = DriveApp.getFileById(TEMPLATE_DOC_ID);
        const newDocFile = templateFile.makeCopy('รายงานการสำรวจ - ' + projectName + ' (' + customerName + ')', targetFolder);
        const doc = DocumentApp.openById(newDocFile.getId());
        const body = doc.getBody();
        
        // แทรกข้อมูลทั่วไป
        body.replaceText('{{PROJECT_NAME}}', projectName);
        body.replaceText('{{CUSTOMER_NAME}}', customerName);
        body.replaceText('{{BUDGET}}', postData.budget ? Number(postData.budget).toLocaleString() + ' บาท' : '-');
        body.replaceText('{{SALES_PERSON}}', postData.salesPersonName || '-');
        body.replaceText('{{SURVEY_DATE}}', postData.surveyDate || '-');
        
        doc.saveAndClose();
        
        const pdfBlob = newDocFile.getAs('application/pdf');
        const newPdfFile = targetFolder.createFile(pdfBlob);
        
        newDocFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
        newPdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        docUrl = newDocFile.getUrl();
        pdfUrl = newPdfFile.getUrl();
      } catch (docErr) {
        // Fallback: หากหา Template ไม่เจอ ให้สร้างไฟล์ Google Doc ใหม่ขึ้นมาในโฟลเดอร์โดยตรง
        const newDoc = DocumentApp.create('รายงานการสำรวจ - ' + projectName + ' (' + customerName + ')');
        const fileId = newDoc.getId();
        
        // ย้ายไฟล์เข้าโฟลเดอร์เป้าหมาย
        const file = DriveApp.getFileById(fileId);
        targetFolder.addFile(file);
        DriveApp.getRootFolder().removeFile(file);
        
        const body = newDoc.getBody();
        body.appendParagraph('รายงานสรุปแบบสำรวจความต้องการหน้างาน (SWS)\n').setHeading(DocumentApp.ParagraphHeading.HEADING1);
        body.appendParagraph('ชื่อโครงการ: ' + projectName);
        body.appendParagraph('ชื่อลูกค้า: ' + customerName);
        body.appendParagraph('งบประมาณประมาณการ: ' + (postData.budget ? Number(postData.budget).toLocaleString() + ' บาท' : '-'));
        body.appendParagraph('ผู้สำรวจ: ' + (postData.salesPersonName || '-'));
        body.appendParagraph('วันที่เข้าสำรวจ: ' + (postData.surveyDate || '-'));
        
        newDoc.saveAndClose();
        
        const pdfBlob = file.getAs('application/pdf');
        const newPdfFile = targetFolder.createFile(pdfBlob);
        
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
        newPdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        docUrl = file.getUrl();
        pdfUrl = newPdfFile.getUrl();
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        docUrl: docUrl,
        pdfUrl: pdfUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: 'Invalid Action'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}
