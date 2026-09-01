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

    // ACTION: DELETE IMAGE
    if (action === 'deleteImage') {
      const fileUrl = postData.fileUrl || '';
      const fileId = postData.fileId || (fileUrl.match(/id=([a-zA-Z0-9_-]+)/) ? fileUrl.match(/id=([a-zA-Z0-9_-]+)/)[1] : (fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/) ? fileUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)[1] : ''));
      if (fileId) {
        try {
          const file = DriveApp.getFileById(fileId);
          file.setTrashed(true); // ย้ายลงถังขยะใน Google Drive
          return ContentService.createTextOutput(JSON.stringify({
            success: true,
            message: 'File moved to trash successfully'
          })).setMimeType(ContentService.MimeType.JSON);
        } catch (delErr) {
          console.warn('Could not trash file from Google Drive: ' + delErr.toString());
        }
      }
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        error: 'File ID not found or could not be trashed'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Helper to find the latest active file in targetFolder by project name
    const findLatestProjectFile = function(folder, keyword, isPdf, sinceTimestamp) {
      if (!keyword) return null;
      try {
        const cleanKeyword = keyword.replace(/'/g, "\\'");
        const mimeFilter = isPdf ? " and mimeType = 'application/pdf'" : " and mimeType != 'application/pdf'";
        const query = "title contains '" + cleanKeyword + "'" + mimeFilter + " and trashed = false";
        const files = folder.searchFiles(query);
        let latestFile = null;
        let latestTime = 0;
        while (files.hasNext()) {
          const file = files.next();
          const created = file.getDateCreated().getTime();
          // Ignore files created before the requested timestamp to prevent premature match with old versions
          if (sinceTimestamp && created < (sinceTimestamp - 10000)) {
            continue;
          }
          if (created > latestTime) {
            latestTime = created;
            latestFile = file;
          }
        }
        return latestFile;
      } catch (e) {
        console.warn('findLatestProjectFile error: ' + e.toString());
        return null;
      }
    };

    // ACTION: FIND EXISTING REPORT IN GOOGLE DRIVE
    if (action === 'findReport') {
      const projectName = postData.projectName || '';
      const targetFolder = DriveApp.getFolderById(DOCUMENT_FOLDER_ID);
      const sinceTimestamp = postData.sinceTimestamp ? Number(postData.sinceTimestamp) : null;
      
      let docUrl = '';
      let pdfUrl = '';
      
      const docFile = findLatestProjectFile(targetFolder, projectName, false, sinceTimestamp);
      if (docFile) {
        docUrl = 'https://docs.google.com/spreadsheets/d/' + docFile.getId() + '/edit?usp=sharing';
      }
      
      const pdfFile = findLatestProjectFile(targetFolder, projectName, true, sinceTimestamp);
      if (pdfFile) {
        pdfUrl = 'https://drive.google.com/file/d/' + pdfFile.getId() + '/view?usp=sharing';
      } else if (docFile) {
        pdfUrl = 'https://docs.google.com/spreadsheets/d/' + docFile.getId() + '/export?format=pdf';
      }
      
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        found: !!docUrl,
        docUrl: docUrl,
        pdfUrl: pdfUrl
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // ACTION: CREATE REPORT DOC & PDF
    if (action === 'createReport') {
      const projectName = postData.projectName || 'ไม่ได้ระบุ';
      const customerName = postData.customerName || 'ไม่ได้ระบุ';
      const targetFolder = DriveApp.getFolderById(DOCUMENT_FOLDER_ID);
      const targetFileName = 'รายงานการสำรวจ - ' + projectName + ' (' + customerName + ')';
      
      // --- 0. ลบไฟล์เอกสารเก่าและ PDF เก่าของโครงการนี้ทิ้งอัตโนมัติ เพื่อป้องกันไฟล์ขยะซ้ำซ้อน ---
      const trashFileByUrl = function(url) {
        if (!url || typeof url !== 'string') return;
        const match = url.match(/[-\w]{25,}/);
        if (match) {
          try {
            const oldFile = DriveApp.getFileById(match[0]);
            oldFile.setTrashed(true);
            console.log('Trashed old report file by URL ID: ' + match[0]);
          } catch (e) {
            console.warn('Could not trash old file by URL: ' + e.toString());
          }
        }
      };

      // ลบจาก URL เดิมที่ส่งมา
      trashFileByUrl(postData.oldDocUrl);
      trashFileByUrl(postData.oldPdfUrl);

      // ค้นหาไฟล์โครงการนี้ที่มีอยู่เดิมทั้งหมดในโฟลเดอร์ปลายทางแล้วย้ายลงถังขยะ (ลบทั้ง Docs และ PDFs เก่า)
      try {
        const cleanKeyword = projectName.replace(/'/g, "\\'");
        const cleanQuery = "title contains '" + cleanKeyword + "' and trashed = false";
        const oldFiles = targetFolder.searchFiles(cleanQuery);
        while (oldFiles.hasNext()) {
          const oldFile = oldFiles.next();
          oldFile.setTrashed(true);
          console.log('Trashed previous project file: ' + oldFile.getName() + ' (' + oldFile.getId() + ')');
        }
      } catch (cleanErr) {
        console.warn('Error cleaning up existing files in target folder: ' + cleanErr.toString());
      }

      // คัดลอกแบบฟอร์มเปล่าเพื่อเตรียมทำเอกสารใหม่
      let docUrl = '';
      let pdfUrl = '';
      
      try {
        const templateFile = DriveApp.getFileById(TEMPLATE_DOC_ID);
        const mimeType = templateFile.getMimeType();
        const newDocFile = templateFile.makeCopy(targetFileName, targetFolder);
        console.log('Successfully copied template file. New file ID: ' + newDocFile.getId() + ', MIME Type: ' + mimeType);
        
        if (mimeType.indexOf('spreadsheet') !== -1) {
          const ss = SpreadsheetApp.openById(newDocFile.getId());
          const sheets = ss.getSheets();
          console.log('Successfully opened spreadsheet. Total sheet tabs: ' + sheets.length);
          
          // --- 1. Project Info Mapping ---
          const budgetVal = postData.budget || '';
          const cleanBudget = String(budgetVal).replace(/[^0-9.]/g, '');
          const parsedBudget = cleanBudget ? Number(cleanBudget) : NaN;
          const budgetText = !isNaN(parsedBudget) ? parsedBudget.toLocaleString() + ' บาท' : (budgetVal || '-');

          const projectMap = {
            '{{PROJECT_NAME}}': projectName,
            '{{CUSTOMER_NAME}}': customerName,
            '{{BUDGET}}': budgetText,
            '{{SALES_PERSON}}': postData.salesPersonName || '-',
            '{{SURVEY_DATE}}': postData.surveyDate || '-',
            '{{REQUEST_DATE}}': postData.requestDate || '-',
            '{{QUOTATION_DEADLINE}}': postData.quotationDeadline || '-',
            '{{CONTACT_NAME}}': postData.contactName || '-',
            '{{CONTACT_PHONE}}': postData.contactPhone || '-',
            '{{LOCATION_ADDRESS}}': postData.locationAddress || '-',
            '{{LOCATION_LAT}}': postData.locationLat ? String(postData.locationLat) : '-',
            '{{LOCATION_LNG}}': postData.locationLng ? String(postData.locationLng) : '-'
          };

          const rooms = postData.roomsData || [];

          // --- 2. Unified Room Placeholders Replacer ---
          const replaceRoomPlaceholders = (text, room) => {
            if (typeof text !== 'string' || !room) return text;
            
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
          
          // --- 3. Fast In-Memory Sheet Replacer (10x Speedup) ---
          const replaceAllInSheetFast = (sheet, room) => {
            const lastRow = sheet.getLastRow();
            const lastCol = sheet.getLastColumn();
            if (lastRow === 0 || lastCol === 0) return;

            const range = sheet.getRange(1, 1, lastRow, lastCol);
            const values = range.getValues();
            let changed = false;

            for (let r = 0; r < lastRow; r++) {
              for (let c = 0; c < lastCol; c++) {
                let cellVal = values[r][c];
                if (typeof cellVal === 'string' && cellVal.indexOf('{{') !== -1) {
                  let text = cellVal;
                  // Replace project info
                  for (const tag in projectMap) {
                    if (text.indexOf(tag) !== -1) {
                      text = text.split(tag).join(projectMap[tag]);
                    }
                  }
                  // Replace room info if room provided
                  if (room) {
                    text = replaceRoomPlaceholders(text, room);
                  }
                  if (text !== cellVal) {
                    values[r][c] = text;
                    changed = true;
                  }
                }
              }
            }

            if (changed) {
              range.setValues(values);
            }
          };

          // Step 1: Building image placeholders
          const existingImages = postData.existingImages || [];
          const bUrl1 = existingImages[0] ? (existingImages[0].annotatedImage || existingImages[0].originalImage) : '';
          const bUrl2 = existingImages[1] ? (existingImages[1].annotatedImage || existingImages[1].originalImage) : '';
          const bUrl3 = existingImages[2] ? (existingImages[2].annotatedImage || existingImages[2].originalImage) : '';
          const bUrl4 = existingImages[3] ? (existingImages[3].annotatedImage || existingImages[3].originalImage) : '';

          const buildingImageMap = [
            { tags: ['{{BUILDING_IMAGE_1}}', '{{SITE_IMAGE_1}}', '{{EXISTING_IMAGE_1}}', '{{IMAGE_BUILDING_1}}'], url: bUrl1 },
            { tags: ['{{BUILDING_IMAGE_2}}', '{{SITE_IMAGE_2}}', '{{EXISTING_IMAGE_2}}', '{{IMAGE_BUILDING_2}}'], url: bUrl2 },
            { tags: ['{{BUILDING_IMAGE_3}}', '{{SITE_IMAGE_3}}', '{{EXISTING_IMAGE_3}}', '{{IMAGE_BUILDING_3}}'], url: bUrl3 },
            { tags: ['{{BUILDING_IMAGE_4}}', '{{SITE_IMAGE_4}}', '{{EXISTING_IMAGE_4}}', '{{IMAGE_BUILDING_4}}'], url: bUrl4 },
          ];

          for (const sheet of sheets) {
            replaceAllInSheetFast(sheet, null);

            for (const item of buildingImageMap) {
              for (const tag of item.tags) {
                const range = sheet.createTextFinder(tag).findNext();
                if (range) {
                  range.setValue(item.url ? SpreadsheetApp.newCellImage().setSourceUrl(item.url).build() : '');
                }
              }
            }

            const isStep1Sheet = sheet.getName().indexOf('1') === 0 || sheet.getName().includes('ทั่วไป') || sheet.getName().includes('อาคาร');
            if (isStep1Sheet) {
              const rImg1 = sheet.createTextFinder('{{IMAGE_1}}').findNext();
              if (rImg1) rImg1.setValue(bUrl1 ? SpreadsheetApp.newCellImage().setSourceUrl(bUrl1).build() : '');
              const rImg2 = sheet.createTextFinder('{{IMAGE_2}}').findNext();
              if (rImg2) rImg2.setValue(bUrl2 ? SpreadsheetApp.newCellImage().setSourceUrl(bUrl2).build() : '');
            }
          }

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
                const newSheetName = sheetName + ' - ' + roomNameStr.substring(0, 20);
                
                const clonedSheet = sheet.copyTo(ss);
                clonedSheet.setName(newSheetName);
                
                let stepNum = 2;
                if (sheetName.indexOf('3') === 0) stepNum = 3;
                else if (sheetName.indexOf('4') === 0) stepNum = 4;
                else if (sheetName.indexOf('5') === 0) stepNum = 5;

                const stepImages = (room.images || []).filter(function(img) {
                  return Number(img.step) === stepNum;
                });

                const url1 = stepImages[0] ? stepImages[0].annotatedImage : '';
                const url2 = stepImages[1] ? stepImages[1].annotatedImage : '';

                // Fast in-memory replacements for all room tags
                replaceAllInSheetFast(clonedSheet, room);

                // Replace image placeholders using native CellImage
                const range1 = clonedSheet.createTextFinder('{{IMAGE_1}}').findNext();
                if (range1) {
                  range1.setValue(url1 ? SpreadsheetApp.newCellImage().setSourceUrl(url1).build() : '');
                }

                const range2 = clonedSheet.createTextFinder('{{IMAGE_2}}').findNext();
                if (range2) {
                  range2.setValue(url2 ? SpreadsheetApp.newCellImage().setSourceUrl(url2).build() : '');
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
        
        try {
          newDocFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.EDIT);
        } catch (shareErr) {
          console.warn("Could not set sharing permissions: " + shareErr.toString());
        }

        docUrl = 'https://docs.google.com/spreadsheets/d/' + newDocFile.getId() + '/edit?usp=sharing';
        pdfUrl = 'https://docs.google.com/spreadsheets/d/' + newDocFile.getId() + '/export?format=pdf';

        try {
          SpreadsheetApp.flush();
          const pdfBlob = newDocFile.getAs('application/pdf');
          pdfBlob.setName(targetFileName + '.pdf');
          const newPdfFile = targetFolder.createFile(pdfBlob);
          newPdfFile.setName(targetFileName + '.pdf');
          try {
            newPdfFile.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
          } catch (se) {}
          pdfUrl = 'https://drive.google.com/file/d/' + newPdfFile.getId() + '/view?usp=sharing';
          console.log('Successfully created PDF in Google Drive: ' + pdfUrl);
        } catch (pdfErr) {
          console.warn('PDF file creation note (using direct export URL): ' + pdfErr.toString());
        }

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
