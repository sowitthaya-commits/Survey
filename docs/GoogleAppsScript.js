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
const IMAGE_FOLDER_ID = '133P6jxYlZ0ixXPhuYwFQ8tjbNCATEnFT'; // โฟลเดอร์เก็บรูปภาพ
const DOCUMENT_FOLDER_ID = '1gRZn1_W_5uMuCVq9EG-VYFWoYOKmur0y'; // โฟลเดอร์เก็บเอกสารสรุป/Sheets
const TEMPLATE_DOC_ID = '1R9jp0ft4gyw-_RpEvDYSF0jX0cLkttsAxyYGH4JboAY'; // ID ของ Google Sheet Template ที่ใช้งาน

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
        const mimeType = templateFile.getMimeType();
        const newDocFile = templateFile.makeCopy('รายงานการสำรวจ - ' + projectName + ' (' + customerName + ')', targetFolder);
        
        if (mimeType.indexOf('spreadsheet') !== -1) {
          const ss = SpreadsheetApp.openById(newDocFile.getId());
          const sheets = ss.getSheets();
          
          // --- 1. Replace Project Info on ALL Sheets ---
          const budgetVal = postData.budget || '';
          const cleanBudget = String(budgetVal).replace(/[^0-9.]/g, '');
          const parsedBudget = cleanBudget ? Number(cleanBudget) : NaN;
          const budgetText = !isNaN(parsedBudget) ? parsedBudget.toLocaleString() + ' บาท' : (budgetVal || '-');

          for (const sheet of sheets) {
            sheet.createTextFinder('{{PROJECT_NAME}}').replaceAllWith(projectName);
            sheet.createTextFinder('{{CUSTOMER_NAME}}').replaceAllWith(customerName);
            sheet.createTextFinder('{{BUDGET}}').replaceAllWith(budgetText);
            sheet.createTextFinder('{{SALES_PERSON}}').replaceAllWith(postData.salesPersonName || '-');
            sheet.createTextFinder('{{SURVEY_DATE}}').replaceAllWith(postData.surveyDate || '-');
            sheet.createTextFinder('{{REQUEST_DATE}}').replaceAllWith(postData.requestDate || '-');
            sheet.createTextFinder('{{QUOTATION_DEADLINE}}').replaceAllWith(postData.quotationDeadline || '-');
            sheet.createTextFinder('{{CONTACT_NAME}}').replaceAllWith(postData.contactName || '-');
            sheet.createTextFinder('{{CONTACT_PHONE}}').replaceAllWith(postData.contactPhone || '-');
            sheet.createTextFinder('{{LOCATION_ADDRESS}}').replaceAllWith(postData.locationAddress || '-');
            sheet.createTextFinder('{{LOCATION_LAT}}').replaceAllWith(postData.locationLat ? String(postData.locationLat) : '-');
            sheet.createTextFinder('{{LOCATION_LNG}}').replaceAllWith(postData.locationLng ? String(postData.locationLng) : '-');
          }
          
          const rooms = postData.roomsData || [];
          
          // --- 2. Unified Room Placeholders Replacer ---
          const replaceRoomPlaceholders = (text, room) => {
            if (typeof text !== 'string') return text;
            
            return text
              // Step 2: Room structure
              .replace(/\{\{ROOM_NAME\}\}/g, room.name || '')
              .replace(/\{\{ROOM_FLOOR\}\}/g, room.floor || '')
              .replace(/\{\{ROOM_WIDTH\}\}/g, room.roomWidth ? String(room.roomWidth) : '-')
              .replace(/\{\{ROOM_LENGTH\}\}/g, room.roomLength ? String(room.roomLength) : '-')
              .replace(/\{\{ROOM_HEIGHT\}\}/g, room.roomHeight ? String(room.roomHeight) : '-')
              .replace(/\{\{INSTALLATION_TYPE\}\}/g, room.installationType || '-')
              .replace(/\{\{SURFACE_TYPE\}\}/g, room.surfaceType || '-')
              .replace(/\{\{STRUCTURE_RESP\}\}/g, room.structureResponsibility || '-')
              .replace(/\{\{CABLING_RESP\}\}/g, room.cablingResponsibility || '-')
              .replace(/\{\{POWER_RESP\}\}/g, room.mainPowerResponsibility || '-')
              .replace(/\{\{DISTANCE_CONTROL\}\}/g, room.distanceToControlRoom ? String(room.distanceToControlRoom) : '-')
              .replace(/\{\{RACK_LOCATION\}\}/g, room.rackLocation || '-')
              .replace(/\{\{RACK_RESP\}\}/g, room.rackResponsibility || '-')
              .replace(/\{\{RACK_POWER_RESP\}\}/g, room.rackPowerSource || '-')
              .replace(/\{\{WALL_PLATE_WIRING\}\}/g, room.wallPlateWiring || '-')
              .replace(/\{\{WALL_PLATE_TYPE\}\}/g, room.wallPlateType || '-')
              .replace(/\{\{WALL_PLATE_LOC\}\}/g, room.wallPlateLocation || '-')
              // Step 3: Visual / Display
              .replace(/\{\{LED_WIDTH\}\}/g, room.ledWidth ? String(room.ledWidth) : '-')
              .replace(/\{\{LED_HEIGHT\}\}/g, room.ledHeight ? String(room.ledHeight) : '-')
              .replace(/\{\{LED_PITCH\}\}/g, room.ledPixelPitch || '-')
              .replace(/\{\{LED_TYPE\}\}/g, room.ledType || '-')
              .replace(/\{\{LED_SUBSTRATE\}\}/g, room.ledSubstrate || '-')
              .replace(/\{\{LED_APPLICATION\}\}/g, room.ledApplication || '-')
              .replace(/\{\{INTERACTIVE_QTY\}\}/g, room.interactiveQty ? String(room.interactiveQty) : '-')
              .replace(/\{\{INTERACTIVE_SIZE\}\}/g, room.interactiveSize ? String(room.interactiveSize) : '-')
              .replace(/\{\{INTERACTIVE_BRAND\}\}/g, room.interactiveBrand || '-')
              .replace(/\{\{PROJECTOR_QTY\}\}/g, room.projectorQty ? String(room.projectorQty) : '-')
              .replace(/\{\{PROJECTOR_LUMEN\}\}/g, room.projectorLumen ? String(room.projectorLumen) : '-')
              .replace(/\{\{PROJECTOR_BRAND\}\}/g, room.projectorBrand || '-')
              .replace(/\{\{SIDE_DISPLAY_TYPE\}\}/g, room.sideDisplayType || '-')
              .replace(/\{\{SIDE_DISPLAY_QTY\}\}/g, room.sideDisplayQty ? String(room.sideDisplayQty) : '-')
              .replace(/\{\{SIDE_DISPLAY_IMAGE\}\}/g, room.sideDisplayDiffImage || '-')
              .replace(/\{\{PTZ_QTY\}\}/g, room.ptzQty ? String(room.ptzQty) : '-')
              .replace(/\{\{PTZ_TRACKING\}\}/g, room.ptzTracking || '-')
              .replace(/\{\{PTZ_BRAND\}\}/g, room.ptzBrand || '-')
              .replace(/\{\{SIGNAGE_QTY\}\}/g, room.signageQty ? String(room.signageQty) : '-')
              .replace(/\{\{SIGNAGE_SIZE\}\}/g, room.signageSize ? String(room.signageSize) : '-')
              .replace(/\{\{SIGNAGE_BRAND\}\}/g, room.signageBrand || '-')
              .replace(/\{\{VISUAL_NOTE\}\}/g, room.visualNote || '-')
              // Step 4: Audio
              .replace(/\{\{MIC_WIRED_QTY\}\}/g, room.micWiredQty ? String(room.micWiredQty) : '-')
              .replace(/\{\{MIC_WIRED_BRAND\}\}/g, room.micWiredBrand || '-')
              .replace(/\{\{MIC_HAND_QTY\}\}/g, room.micWirelessHandQty ? String(room.micWirelessHandQty) : '-')
              .replace(/\{\{MIC_HAND_BRAND\}\}/g, room.micWirelessHandBrand || '-')
              .replace(/\{\{MIC_LAPEL_QTY\}\}/g, room.micWirelessLapelQty ? String(room.micWirelessLapelQty) : '-')
              .replace(/\{\{MIC_LAPEL_BRAND\}\}/g, room.micWirelessLapelBrand || '-')
              .replace(/\{\{SPEAKER_TYPE\}\}/g, room.speakerType || '-')
              .replace(/\{\{SPEAKER_BRAND\}\}/g, room.speakerBrand || '-')
              .replace(/\{\{AIO_QTY\}\}/g, room.allInOneQty ? String(room.allInOneQty) : '-')
              .replace(/\{\{AIO_WIRELESS_TYPE\}\}/g, room.allInOneWirelessType || '-')
              .replace(/\{\{AIO_BRAND\}\}/g, room.allInOneBrand || '-')
              .replace(/\{\{VDO_PLATFORM\}\}/g, room.vdoConferencePlatform || '-')
              .replace(/\{\{TABLETOP_CHAIRMAN\}\}/g, room.tabletopChairmanQty ? String(room.tabletopChairmanQty) : '-')
              .replace(/\{\{TABLETOP_DELEGATE\}\}/g, room.tabletopDelegateQty ? String(room.tabletopDelegateQty) : '-')
              .replace(/\{\{TABLETOP_TYPE\}\}/g, room.tabletopType || '-')
              .replace(/\{\{TABLETOP_BRAND\}\}/g, room.tabletopBrand || '-')
              .replace(/\{\{TABLETOP_SPECIAL\}\}/g, room.tabletopSpecialFeatures || '-')
              .replace(/\{\{AUDIO_NOTE\}\}/g, room.audioNote || '-')
              // Step 5: Control & Network
              .replace(/\{\{CONTROL_TYPE\}\}/g, room.controlType || '-')
              .replace(/\{\{CONTROL_INTERFACE\}\}/g, room.controlInterface || '-')
              .replace(/\{\{CONTROL_IPAD\}\}/g, room.controlIpadStatus || '-')
              .replace(/\{\{CONTROL_NOTE\}\}/g, room.controlNote || '-')
              .replace(/\{\{NETWORK_INTERFACE\}\}/g, room.networkInterface || '-')
              .replace(/\{\{NETWORK_IP\}\}/g, room.networkIPRequirement || '-')
              .replace(/\{\{NETWORK_RESP\}\}/g, room.networkResponsibility || '-')
              .replace(/\{\{NETWORK_NOTE\}\}/g, room.networkNote || '-');
          };
          
          // --- 3. Process Dynamic Room Rows in ALL Sheets containing {{ROOM_NAME}} ---
          for (const sheet of sheets) {
            const lastRow = sheet.getLastRow();
            const lastCol = sheet.getLastColumn();
            if (lastRow === 0 || lastCol === 0) continue;
            
            const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
            let templateRowIdx = -1;
            for (let r = 0; r < lastRow; r++) {
              for (let c = 0; c < lastCol; c++) {
                if (String(values[r][c]).includes('{{ROOM_NAME}}')) {
                  templateRowIdx = r + 1; // 1-indexed
                  break;
                }
              }
              if (templateRowIdx !== -1) break;
            }
            
            if (templateRowIdx === -1) continue; // No template row in this sheet
            
            // Copy template row formulas/values
            const templateRange = sheet.getRange(templateRowIdx, 1, 1, lastCol);
            const templateFormulas = templateRange.getFormulas()[0];
            const templateValues = templateRange.getValues()[0];
            
            // We write the rooms data below the template row
            for (let i = 0; i < rooms.length; i++) {
              const targetRowIdx = templateRowIdx + i + 1;
              sheet.insertRowAfter(targetRowIdx - 1);
              
              // Copy formats from template row
              templateRange.copyTo(sheet.getRange(targetRowIdx, 1, 1, lastCol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
              
              // Build values for target row
              const rowValues = [];
              for (let c = 0; c < lastCol; c++) {
                let cellText = templateFormulas[c] || templateValues[c];
                if (typeof cellText === 'string') {
                  cellText = replaceRoomPlaceholders(cellText, rooms[i]);
                }
                rowValues.push(cellText);
              }
              
              sheet.getRange(targetRowIdx, 1, 1, lastCol).setValues([rowValues]);
            }
            
            // Delete the template row
            sheet.deleteRow(templateRowIdx);
          }
          
          SpreadsheetApp.flush();
        } else {
          const doc = DocumentApp.openById(newDocFile.getId());
          const body = doc.getBody();
          
          // แทรกข้อมูลทั่วไป
          body.replaceText('{{PROJECT_NAME}}', projectName);
          body.replaceText('{{CUSTOMER_NAME}}', customerName);
          body.replaceText('{{BUDGET}}', postData.budget ? Number(postData.budget).toLocaleString() + ' บาท' : '-');
          body.replaceText('{{SALES_PERSON}}', postData.salesPersonName || '-');
          body.replaceText('{{SURVEY_DATE}}', postData.surveyDate || '-');
          
          doc.saveAndClose();
        }
        
        const pdfBlob = newDocFile.getAs('application/pdf');
        const newPdfFile = targetFolder.createFile(pdfBlob);
        
        newDocFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
        newPdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        
        docUrl = newDocFile.getUrl();
        pdfUrl = newPdfFile.getUrl();
      } catch (docErr) {
        console.error("Error generating spreadsheet report: " + docErr.toString() + "\n" + docErr.stack);
        throw new Error("ล้มเหลวในการเขียนข้อมูลลง Google Sheets Template: " + docErr.toString());
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
