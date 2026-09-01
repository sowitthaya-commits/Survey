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
      const rootFolder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
      const base64Data = postData.imageBase64;
      const fileName = postData.fileName || ('sws_image_' + new Date().getTime() + '.jpg');
      const projectName = postData.projectName || postData.folderName || '';
      const customerName = postData.customerName || '';

      // จัดการสร้าง/ค้นหาโฟลเดอร์แยกตามรายโครงการ
      let targetFolderName = 'รูปภาพสำรวจทั่วไป';
      if (projectName) {
        targetFolderName = projectName + (customerName ? ' (' + customerName + ')' : '');
      }

      let targetFolder;
      const subFolders = rootFolder.getFoldersByName(targetFolderName);
      if (subFolders.hasNext()) {
        targetFolder = subFolders.next();
      } else {
        targetFolder = rootFolder.createFolder(targetFolderName);
        targetFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      }
      
      const cleanBase64 = base64Data.replace(/^data:image\/[a-z-]+\/?[a-z-]+;base64,/, '');
      const decoded = Utilities.base64Decode(cleanBase64);
      const mimeType = base64Data.includes('image/png') ? 'image/png' : 'image/jpeg';
      const blob = Utilities.newBlob(decoded, mimeType, fileName);
      
      const file = targetFolder.createFile(blob);
      
      // ตั้งค่าแชร์ให้ทุกคนเข้าดูได้ทางเว็บ
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        url: 'https://docs.google.com/uc?export=view&id=' + file.getId(),
        folderUrl: targetFolder.getUrl(),
        folderId: targetFolder.getId()
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
        console.log('Successfully copied template file. New file ID: ' + newDocFile.getId() + ', MIME Type: ' + mimeType);
        
        if (mimeType.indexOf('spreadsheet') !== -1) {
          const ss = SpreadsheetApp.openById(newDocFile.getId());
          const sheets = ss.getSheets();
          console.log('Successfully opened spreadsheet. Total sheet tabs: ' + sheets.length);
          
          // --- 1. Replace Project Info on ALL Sheets ---
          const budgetVal = postData.budget || '';
          const cleanBudget = String(budgetVal).replace(/[^0-9.]/g, '');
          const parsedBudget = cleanBudget ? Number(cleanBudget) : NaN;
          const budgetText = !isNaN(parsedBudget) ? parsedBudget.toLocaleString() + ' บาท' : (budgetVal || '-');
          console.log('Project Info to replace: ' + JSON.stringify({ projectName, customerName, budgetText }));

          for (const sheet of sheets) {
            const sheetName = sheet.getName();
            const r1 = sheet.createTextFinder('{{PROJECT_NAME}}').replaceAllWith(projectName);
            const r2 = sheet.createTextFinder('{{CUSTOMER_NAME}}').replaceAllWith(customerName);
            const r3 = sheet.createTextFinder('{{BUDGET}}').replaceAllWith(budgetText);
            const r4 = sheet.createTextFinder('{{SALES_PERSON}}').replaceAllWith(postData.salesPersonName || '-');
            const r5 = sheet.createTextFinder('{{SURVEY_DATE}}').replaceAllWith(postData.surveyDate || '-');
            const r6 = sheet.createTextFinder('{{REQUEST_DATE}}').replaceAllWith(postData.requestDate || '-');
            const r7 = sheet.createTextFinder('{{QUOTATION_DEADLINE}}').replaceAllWith(postData.quotationDeadline || '-');
            const r8 = sheet.createTextFinder('{{CONTACT_NAME}}').replaceAllWith(postData.contactName || '-');
            const r9 = sheet.createTextFinder('{{CONTACT_PHONE}}').replaceAllWith(postData.contactPhone || '-');
            const r10 = sheet.createTextFinder('{{LOCATION_ADDRESS}}').replaceAllWith(postData.locationAddress || '-');
            const r11 = sheet.createTextFinder('{{LOCATION_LAT}}').replaceAllWith(postData.locationLat ? String(postData.locationLat) : '-');
            const r12 = sheet.createTextFinder('{{LOCATION_LNG}}').replaceAllWith(postData.locationLng ? String(postData.locationLng) : '-');
            console.log('Sheet "' + sheetName + '" replacements count: PROJECT_NAME=' + r1 + ', CUSTOMER_NAME=' + r2 + ', BUDGET=' + r3);
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
          
          // --- 3. Process Dynamic Room Rows or Tab Duplication in ALL Sheets ---
          const ROOM_PLACEHOLDERS = [
            '{{ROOM_FLOOR}}', '{{ROOM_WIDTH}}', '{{ROOM_LENGTH}}', '{{ROOM_HEIGHT}}',
            '{{INSTALLATION_TYPE}}', '{{SURFACE_TYPE}}', '{{STRUCTURE_RESP}}',
            '{{CABLING_RESP}}', '{{POWER_RESP}}', '{{DISTANCE_CONTROL}}',
            '{{RACK_LOCATION}}', '{{RACK_RESP}}', '{{RACK_POWER_RESP}}',
            '{{WALL_PLATE_WIRING}}', '{{WALL_PLATE_TYPE}}', '{{WALL_PLATE_LOC}}',
            '{{LED_WIDTH}}', '{{LED_HEIGHT}}', '{{LED_PITCH}}', '{{LED_TYPE}}',
            '{{LED_SUBSTRATE}}', '{{LED_APPLICATION}}', '{{INTERACTIVE_QTY}}',
            '{{INTERACTIVE_SIZE}}', '{{INTERACTIVE_BRAND}}', '{{PROJECTOR_QTY}}',
            '{{PROJECTOR_LUMEN}}', '{{PROJECTOR_BRAND}}', '{{SIDE_DISPLAY_TYPE}}',
            '{{SIDE_DISPLAY_QTY}}', '{{SIDE_DISPLAY_IMAGE}}', '{{PTZ_QTY}}',
            '{{PTZ_TRACKING}}', '{{PTZ_BRAND}}', '{{SIGNAGE_QTY}}',
            '{{SIGNAGE_SIZE}}', '{{SIGNAGE_BRAND}}', '{{VISUAL_NOTE}}',
            '{{MIC_WIRED_QTY}}', '{{MIC_WIRED_BRAND}}', '{{MIC_HAND_QTY}}',
            '{{MIC_HAND_BRAND}}', '{{MIC_LAPEL_QTY}}', '{{MIC_LAPEL_BRAND}}',
            '{{SPEAKER_TYPE}}', '{{SPEAKER_BRAND}}', '{{AIO_QTY}}',
            '{{AIO_WIRELESS_TYPE}}', '{{AIO_BRAND}}', '{{VDO_PLATFORM}}',
            '{{TABLETOP_CHAIRMAN}}', '{{TABLETOP_DELEGATE}}', '{{TABLETOP_TYPE}}',
            '{{TABLETOP_BRAND}}', '{{TABLETOP_SPECIAL}}', '{{AUDIO_NOTE}}',
            '{{CONTROL_TYPE}}', '{{CONTROL_INTERFACE}}', '{{CONTROL_IPAD}}',
            '{{CONTROL_NOTE}}', '{{NETWORK_INTERFACE}}', '{{NETWORK_IP}}',
            '{{NETWORK_RESP}}', '{{NETWORK_NOTE}}'
          ];

          const replacePlaceholdersInSheet = (clonedSheet, room) => {
            clonedSheet.createTextFinder('{{ROOM_NAME}}').replaceAllWith(room.name || '');
            clonedSheet.createTextFinder('{{ROOM_FLOOR}}').replaceAllWith(room.floor || '');
            clonedSheet.createTextFinder('{{ROOM_WIDTH}}').replaceAllWith(room.roomWidth ? String(room.roomWidth) : '-');
            clonedSheet.createTextFinder('{{ROOM_LENGTH}}').replaceAllWith(room.roomLength ? String(room.roomLength) : '-');
            clonedSheet.createTextFinder('{{ROOM_HEIGHT}}').replaceAllWith(room.roomHeight ? String(room.roomHeight) : '-');
            clonedSheet.createTextFinder('{{INSTALLATION_TYPE}}').replaceAllWith(room.installationType || '-');
            clonedSheet.createTextFinder('{{SURFACE_TYPE}}').replaceAllWith(room.surfaceType || '-');
            clonedSheet.createTextFinder('{{STRUCTURE_RESP}}').replaceAllWith(room.structureResponsibility || '-');
            clonedSheet.createTextFinder('{{CABLING_RESP}}').replaceAllWith(room.cablingResponsibility || '-');
            clonedSheet.createTextFinder('{{POWER_RESP}}').replaceAllWith(room.mainPowerResponsibility || '-');
            clonedSheet.createTextFinder('{{DISTANCE_CONTROL}}').replaceAllWith(room.distanceToControlRoom ? String(room.distanceToControlRoom) : '-');
            clonedSheet.createTextFinder('{{RACK_LOCATION}}').replaceAllWith(room.rackLocation || '-');
            clonedSheet.createTextFinder('{{RACK_RESP}}').replaceAllWith(room.rackResponsibility || '-');
            clonedSheet.createTextFinder('{{RACK_POWER_RESP}}').replaceAllWith(room.rackPowerSource || '-');
            clonedSheet.createTextFinder('{{WALL_PLATE_WIRING}}').replaceAllWith(room.wallPlateWiring || '-');
            clonedSheet.createTextFinder('{{WALL_PLATE_TYPE}}').replaceAllWith(room.wallPlateType || '-');
            clonedSheet.createTextFinder('{{WALL_PLATE_LOC}}').replaceAllWith(room.wallPlateLocation || '-');
            
            clonedSheet.createTextFinder('{{LED_WIDTH}}').replaceAllWith(room.ledWidth ? String(room.ledWidth) : '-');
            clonedSheet.createTextFinder('{{LED_HEIGHT}}').replaceAllWith(room.ledHeight ? String(room.ledHeight) : '-');
            clonedSheet.createTextFinder('{{LED_PITCH}}').replaceAllWith(room.ledPixelPitch || '-');
            clonedSheet.createTextFinder('{{LED_TYPE}}').replaceAllWith(room.ledType || '-');
            clonedSheet.createTextFinder('{{LED_SUBSTRATE}}').replaceAllWith(room.ledSubstrate || '-');
            clonedSheet.createTextFinder('{{LED_APPLICATION}}').replaceAllWith(room.ledApplication || '-');
            clonedSheet.createTextFinder('{{INTERACTIVE_QTY}}').replaceAllWith(room.interactiveQty ? String(room.interactiveQty) : '-');
            clonedSheet.createTextFinder('{{INTERACTIVE_SIZE}}').replaceAllWith(room.interactiveSize ? String(room.interactiveSize) : '-');
            clonedSheet.createTextFinder('{{INTERACTIVE_BRAND}}').replaceAllWith(room.interactiveBrand || '-');
            clonedSheet.createTextFinder('{{PROJECTOR_QTY}}').replaceAllWith(room.projectorQty ? String(room.projectorQty) : '-');
            clonedSheet.createTextFinder('{{PROJECTOR_LUMEN}}').replaceAllWith(room.projectorLumen ? String(room.projectorLumen) : '-');
            clonedSheet.createTextFinder('{{PROJECTOR_BRAND}}').replaceAllWith(room.projectorBrand || '-');
            clonedSheet.createTextFinder('{{SIDE_DISPLAY_TYPE}}').replaceAllWith(room.sideDisplayType || '-');
            clonedSheet.createTextFinder('{{SIDE_DISPLAY_QTY}}').replaceAllWith(room.sideDisplayQty ? String(room.sideDisplayQty) : '-');
            clonedSheet.createTextFinder('{{SIDE_DISPLAY_IMAGE}}').replaceAllWith(room.sideDisplayDiffImage || '-');
            clonedSheet.createTextFinder('{{PTZ_QTY}}').replaceAllWith(room.ptzQty ? String(room.ptzQty) : '-');
            clonedSheet.createTextFinder('{{PTZ_TRACKING}}').replaceAllWith(room.ptzTracking || '-');
            clonedSheet.createTextFinder('{{PTZ_BRAND}}').replaceAllWith(room.ptzBrand || '-');
            clonedSheet.createTextFinder('{{SIGNAGE_QTY}}').replaceAllWith(room.signageQty ? String(room.signageQty) : '-');
            clonedSheet.createTextFinder('{{SIGNAGE_SIZE}}').replaceAllWith(room.signageSize ? String(room.signageSize) : '-');
            clonedSheet.createTextFinder('{{SIGNAGE_BRAND}}').replaceAllWith(room.signageBrand || '-');
            clonedSheet.createTextFinder('{{VISUAL_NOTE}}').replaceAllWith(room.visualNote || '-');
            
            clonedSheet.createTextFinder('{{MIC_WIRED_QTY}}').replaceAllWith(room.micWiredQty ? String(room.micWiredQty) : '-');
            clonedSheet.createTextFinder('{{MIC_WIRED_BRAND}}').replaceAllWith(room.micWiredBrand || '-');
            clonedSheet.createTextFinder('{{MIC_HAND_QTY}}').replaceAllWith(room.micWirelessHandQty ? String(room.micWirelessHandQty) : '-');
            clonedSheet.createTextFinder('{{MIC_HAND_BRAND}}').replaceAllWith(room.micWirelessHandBrand || '-');
            clonedSheet.createTextFinder('{{MIC_LAPEL_QTY}}').replaceAllWith(room.micWirelessLapelQty ? String(room.micWirelessLapelQty) : '-');
            clonedSheet.createTextFinder('{{MIC_LAPEL_BRAND}}').replaceAllWith(room.micWirelessLapelBrand || '-');
            clonedSheet.createTextFinder('{{SPEAKER_TYPE}}').replaceAllWith(room.speakerType || '-');
            clonedSheet.createTextFinder('{{SPEAKER_BRAND}}').replaceAllWith(room.speakerBrand || '-');
            clonedSheet.createTextFinder('{{AIO_QTY}}').replaceAllWith(room.allInOneQty ? String(room.allInOneQty) : '-');
            clonedSheet.createTextFinder('{{AIO_WIRELESS_TYPE}}').replaceAllWith(room.allInOneWirelessType || '-');
            clonedSheet.createTextFinder('{{AIO_BRAND}}').replaceAllWith(room.allInOneBrand || '-');
            clonedSheet.createTextFinder('{{VDO_PLATFORM}}').replaceAllWith(room.vdoConferencePlatform || '-');
            clonedSheet.createTextFinder('{{TABLETOP_CHAIRMAN}}').replaceAllWith(room.tabletopChairmanQty ? String(room.tabletopChairmanQty) : '-');
            clonedSheet.createTextFinder('{{TABLETOP_DELEGATE}}').replaceAllWith(room.tabletopDelegateQty ? String(room.tabletopDelegateQty) : '-');
            clonedSheet.createTextFinder('{{TABLETOP_TYPE}}').replaceAllWith(room.tabletopType || '-');
            clonedSheet.createTextFinder('{{TABLETOP_BRAND}}').replaceAllWith(room.tabletopBrand || '-');
            clonedSheet.createTextFinder('{{TABLETOP_SPECIAL}}').replaceAllWith(room.tabletopSpecialFeatures || '-');
            clonedSheet.createTextFinder('{{AUDIO_NOTE}}').replaceAllWith(room.audioNote || '-');
            
            clonedSheet.createTextFinder('{{CONTROL_TYPE}}').replaceAllWith(room.controlType || '-');
            clonedSheet.createTextFinder('{{CONTROL_INTERFACE}}').replaceAllWith(room.controlInterface || '-');
            clonedSheet.createTextFinder('{{CONTROL_IPAD}}').replaceAllWith(room.controlIpadStatus || '-');
            clonedSheet.createTextFinder('{{CONTROL_NOTE}}').replaceAllWith(room.controlNote || '-');
            clonedSheet.createTextFinder('{{NETWORK_INTERFACE}}').replaceAllWith(room.networkInterface || '-');
            clonedSheet.createTextFinder('{{NETWORK_IP}}').replaceAllWith(room.networkIPRequirement || '-');
            clonedSheet.createTextFinder('{{NETWORK_RESP}}').replaceAllWith(room.networkResponsibility || '-');
            clonedSheet.createTextFinder('{{NETWORK_NOTE}}').replaceAllWith(room.networkNote || '-');
          };

          const sheetsToDelete = [];

          for (const sheet of sheets) {
            const sheetName = sheet.getName();
            const lastRow = sheet.getLastRow();
            const lastCol = sheet.getLastColumn();
            if (lastRow === 0 || lastCol === 0) continue;
            
            const hasRoomName = sheet.createTextFinder('{{ROOM_NAME}}').findNext() !== null;
            if (!hasRoomName) continue;

            // Check if vertical layout (contains other room placeholders in the sheet)
            let isVertical = false;
            for (const placeholder of ROOM_PLACEHOLDERS) {
              if (sheet.createTextFinder(placeholder).findNext() !== null) {
                isVertical = true;
                break;
              }
            }

            if (isVertical && rooms.length > 0) {
              console.log('Vertical Sheet Tab layout detected for: "' + sheetName + '". Duplicating tab for each room...');
              for (let i = 0; i < rooms.length; i++) {
                const room = rooms[i];
                const roomNameStr = room.name || ('ห้องที่ ' + (i + 1));
                const newSheetName = sheetName + ' - ' + roomNameStr.substring(0, 20); // Keep tab name short
                
                const clonedSheet = sheet.copyTo(ss);
                clonedSheet.setName(newSheetName);
                
                // Get step number from original sheet name (starts with 2, 3, 4, or 5)
                let stepNum = 2;
                if (sheetName.indexOf('3') === 0) stepNum = 3;
                else if (sheetName.indexOf('4') === 0) stepNum = 4;
                else if (sheetName.indexOf('5') === 0) stepNum = 5;

                // Filter images for this room and step
                const stepImages = (room.images || []).filter(function(img) {
                  return Number(img.step) === stepNum;
                });

                const url1 = stepImages[0] ? stepImages[0].annotatedImage : '';
                const url2 = stepImages[1] ? stepImages[1].annotatedImage : '';

                // Fast TextFinder replacements in place
                replacePlaceholdersInSheet(clonedSheet, room);

                // Replace image placeholders using native CellImage (avoids external data warning & "Allow access" banner)
                const range1 = clonedSheet.createTextFinder('{{IMAGE_1}}').findNext();
                if (range1) {
                  if (url1) {
                    const cellImage1 = SpreadsheetApp.newCellImage().setSourceUrl(url1).build();
                    range1.setValue(cellImage1);
                  } else {
                    range1.setValue('');
                  }
                }

                const range2 = clonedSheet.createTextFinder('{{IMAGE_2}}').findNext();
                if (range2) {
                  if (url2) {
                    const cellImage2 = SpreadsheetApp.newCellImage().setSourceUrl(url2).build();
                    range2.setValue(cellImage2);
                  } else {
                    range2.setValue('');
                  }
                }
              }
              sheetsToDelete.push(sheet);
            } else {
              // Horizontal row replication logic
              console.log('Horizontal Table Row layout detected for: "' + sheetName + '". Replicating rows...');
              let templateRowIdx = -1;
              const values = sheet.getRange(1, 1, lastRow, lastCol).getValues();
              for (let r = 0; r < lastRow; r++) {
                for (let c = 0; c < lastCol; c++) {
                  if (String(values[r][c]).includes('{{ROOM_NAME}}')) {
                    templateRowIdx = r + 1; // 1-indexed
                    break;
                  }
                }
                if (templateRowIdx !== -1) break;
              }
              
              if (templateRowIdx !== -1) {
                const templateRange = sheet.getRange(templateRowIdx, 1, 1, lastCol);
                const templateFormulas = templateRange.getFormulas()[0];
                const templateValues = templateRange.getValues()[0];
                
                for (let i = 0; i < rooms.length; i++) {
                  const targetRowIdx = templateRowIdx + i + 1;
                  sheet.insertRowAfter(targetRowIdx - 1);
                  
                  // Copy formats
                  templateRange.copyTo(sheet.getRange(targetRowIdx, 1, 1, lastCol), SpreadsheetApp.CopyPasteType.PASTE_FORMAT, false);
                  
                  // Build values
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
                // Delete template row
                sheet.deleteRow(templateRowIdx);
              }
            }
          }

          // Delete the original template sheets that were duplicated
          for (const s of sheetsToDelete) {
            ss.deleteSheet(s);
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
        
        try {
          newDocFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
          newPdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        } catch (shareErr) {
          console.warn("Could not set sharing permissions (corporate domain policy restriction): " + shareErr.toString());
        }
        
        docUrl = newDocFile.getUrl();
        pdfUrl = newPdfFile.getUrl();

        // ค้นหาหรือสร้างโฟลเดอร์รูปภาพของโครงการเพื่อส่งกลับไปให้ระบบนำไปเปิดดูใน Gallery
        let imagesFolderUrl = '';
        try {
          const rootImgFolder = DriveApp.getFolderById(IMAGE_FOLDER_ID);
          const projectFolderName = projectName + (customerName ? ' (' + customerName + ')' : '');
          const imgSubFolders = rootImgFolder.getFoldersByName(projectFolderName);
          if (imgSubFolders.hasNext()) {
            imagesFolderUrl = imgSubFolders.next().getUrl();
          } else {
            const newFolder = rootImgFolder.createFolder(projectFolderName);
            newFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
            imagesFolderUrl = newFolder.getUrl();
          }
        } catch (fErr) {
          console.warn("Could not get/create project image folder: " + fErr.toString());
        }

      } catch (docErr) {
        console.error("Error generating spreadsheet report: " + docErr.toString() + "\n" + docErr.stack);
        throw new Error("ล้มเหลวในการเขียนข้อมูลลง Google Sheets Template: " + docErr.toString());
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        docUrl: docUrl,
        pdfUrl: pdfUrl,
        folderUrl: imagesFolderUrl
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

/**
 * ฟังก์ชันสำหรับกดรันเพื่อทดสอบใน Apps Script Editor
 * สามารถคลิกเลือกฟังก์ชันนี้แล้วกดปุ่ม "เรียกใช้ (Run)" เพื่อดูบันทึกข้อความ (Logs) และประมวลผลดูจุดติดขัดได้ทันที
 */
function testCreateReport() {
  const e = {
    postData: {
      contents: JSON.stringify({
        action: 'createReport',
        projectName: 'โครงการทดสอบ A',
        customerName: 'บริษัท ทดสอบ จำกัด',
        budget: '500000',
        salesPersonName: 'ผู้สำรวจทดสอบ',
        surveyDate: '2026-08-30',
        requestDate: '2026-08-29',
        quotationDeadline: '2026-09-05',
        contactName: 'คุณทดสอบ',
        contactPhone: '0812345678',
        locationAddress: 'หน้างานทดสอบ กรุงเทพฯ',
        locationLat: 13.75,
        locationLng: 100.5,
        roomsData: [
          {
            name: 'ห้องทดสอบที่ 1',
            floor: '3',
            roomWidth: 5,
            roomLength: 8,
            roomHeight: 3,
            installationType: 'ติดผนัง',
            surfaceType: 'ผนังปูน',
            structureResponsibility: 'SWS จัดเตรียม',
            cablingResponsibility: 'SWS จัดเตรียม',
            mainPowerResponsibility: 'ลูกค้าจัดเตรียม',
            distanceToControlRoom: 10,
            rackLocation: 'ภายในห้องประชุม',
            rackResponsibility: 'SWS จัดเตรียม',
            rackPowerSource: 'SWS จัดเตรียม',
            wallPlateWiring: 'เดินฝัง',
            wallPlateType: 'HDMI Wall Plate',
            wallPlateLocation: 'ใต้จอ',
            ledWidth: 3,
            ledHeight: 2,
            ledPixelPitch: 'P1.86',
            ledType: 'Flat',
            ledSubstrate: 'SMD',
            ledApplication: 'ห้องประชุม'
          }
        ]
      })
    }
  };
  
  console.log('--- STARTING testCreateReport ---');
  const result = doPost(e);
  console.log('Result Object: ' + result.getContent());
  console.log('--- COMPLETED testCreateReport ---');
}
