/**
 * วางโค้ดนี้ใน Apps Script ที่ผูกกับ Google Sheet โดยตรง
 * (เปิดชีต -> เมนู Extensions > Apps Script -> ลบโค้ดเดิม -> วางโค้ดนี้ -> Save
 *  -> Deploy > Manage deployments > แก้ไข deployment เดิม (หรือสร้างใหม่) เพื่อให้โค้ดที่แก้แล้วมีผลจริง)
 *
 * ทุกคนที่เข้าเว็บจะมี "SessionId" เดียวกันติดไปกับทุกครั้งที่หน้าเว็บส่งข้อมูล
 * (Answer 1, Name1, Answer 2, Act1/2/3, Name2 ฯลฯ) ทำให้ข้อมูลของคนคนเดียวกัน
 * ทั้งหมดถูกเก็บลง "แถวเดียวกัน" ในชีตแรก (Sheet1) แทนที่จะกระจายเป็นคนละแถว:
 *   - ถ้ายังไม่เคยเห็น SessionId นี้มาก่อน -> เพิ่มแถวใหม่
 *   - ถ้าเคยเห็น SessionId นี้แล้ว -> อัปเดตเฉพาะคอลัมน์ที่ส่งมาในแถวเดิม
 *
 * คอลัมน์ใน Sheet1 (ใส่หัวคอลัมน์แถวแรกไว้ก่อนใช้งานจริง):
 * A1: SessionId (ใช้อ้างอิงภายในเท่านั้น ไม่ต้องสนใจค่าที่เห็น)
 * B1: เวลา
 * C1: Answer 1
 * D1: Answer 2
 * E1: Name1
 * F1: Act1
 * G1: Act2
 * H1: Act3
 * I1: Name2
 * J1: Choose1 (เลื่อนนัด / ไม่เลื่อนนัด)
 *
 * ----- ส่วนแอดมิน (เพิ่มใหม่) -----
 * มีชีตแท็บใหม่ชื่อ "Groups" (สร้างอัตโนมัติถ้ายังไม่มี) เก็บ "กลุ่มพฤติกรรม" ได้ไม่จำกัดจำนวน -
 * แอดมินตั้งชื่อกลุ่ม เลือกว่ากลุ่มนั้นมีพฤติกรรมอะไรบ้าง แล้วผูกภาพการ์ดของกลุ่มนั้นไว้
 * การจับคู่การ์ด (ทำทั้งหมดที่ฝั่งเว็บ ดู pickGroupCard() ใน teacher-room.html):
 *   - ถ้าคำตอบของผู้ใช้ (act1/act2/act3 - เลือกมา 3 อย่าง) มีอย่างน้อย 2 อย่างอยู่ในกลุ่ม
 *     เดียวกัน -> แสดงการ์ดของกลุ่มนั้นทันที (เป็นกลุ่มที่ผู้ใช้เลือกไปมากที่สุดชัดเจน)
 *   - ถ้าไม่มีกลุ่มไหนได้ตั้งแต่ 2 อย่าง (เช่น act1/act2/act3 กระจายไปคนละกลุ่มกันหมด
 *     กลุ่มละ 1 อย่าง) -> สุ่มเลือกว่าจะแสดงการ์ดจากกลุ่มไหนในบรรดากลุ่มที่ตรงอย่างน้อย 1 อย่าง
 * คอลัมน์: A=GroupId  B=GroupName  C=Behaviors (ชื่อพฤติกรรมคั่นด้วยจุลภาค)  D=ImageUrl
 * แอดมินแก้ไข (editGroup) และลบ (deleteGroup) กลุ่มที่มีอยู่ได้ตลอดเวลา
 *
 * มีชีตแท็บใหม่อีกอันชื่อ "Behaviors" (สร้างอัตโนมัติถ้ายังไม่มี) เก็บ "พฤติกรรม" ที่แอดมิน
 * เพิ่มเองนอกเหนือจาก 15 อย่างที่มีอยู่แล้วในหน้าเว็บ - พฤติกรรมใหม่ที่เพิ่มจะไปปรากฏใน
 * checklist ทั้งฝั่งผู้ใช้ (ตอนเลือก 3 สิ่งที่อยากทำ) และฝั่งแอดมิน (ตอนสร้าง/แก้ไขกลุ่ม) ทันที
 * คอลัมน์: A=Name
 *
 * การยืนยันตัวตนแอดมินที่นี่เป็นแบบง่ายมาก (เทียบ user/pass ตรง ๆ ตามที่ขอ) -
 * ไม่ใช่ระบบความปลอดภัยระดับใช้งานจริง เพราะ user/pass ("admin"/"1234") ฝังอยู่ใน
 * โค้ด JS ฝั่งเว็บที่ใครก็ดู source ได้ ถ้าจะใช้งานจริงจังควรทำระบบล็อกอินที่รัดกุมกว่านี้
 */

var COLUMNS = {
  'Answer 1': 3,
  'Answer 2': 4,
  'Name1':    5,
  'Act1':     6,
  'Act2':     7,
  'Act3':     8,
  'Name2':    9,
  'Choose1':  10
};

var ADMIN_USER = 'admin';
var ADMIN_PASS = '1234';

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000); // avoid two near-simultaneous requests racing on the same row lookup
  try {
    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    var sessionId = (e.parameter['SessionId'] || '').toString();

    var rowIndex = -1; // 1-based row number in the sheet, if we find an existing match
    if (sessionId) {
      var ids = sheet.getRange(1, 1, Math.max(sheet.getLastRow(), 1), 1).getValues();
      for (var i = 0; i < ids.length; i++) {
        if (ids[i][0] === sessionId) { rowIndex = i + 1; break; }
      }
    }

    if (rowIndex === -1) {
      // first time we've seen this visitor - append a fresh row
      var newRow = [sessionId, new Date(), '', '', '', '', '', '', '', ''];
      Object.keys(COLUMNS).forEach(function (key) {
        if (e.parameter[key] !== undefined) {
          newRow[COLUMNS[key] - 1] = e.parameter[key].toString();
        }
      });
      sheet.appendRow(newRow);
    } else {
      // this visitor already has a row - fill in just the columns sent this time
      Object.keys(COLUMNS).forEach(function (key) {
        if (e.parameter[key] !== undefined) {
          sheet.getRange(rowIndex, COLUMNS[key]).setValue(e.parameter[key].toString());
        }
      });
    }
  } finally {
    lock.releaseLock();
  }

  return ContentService
    .createTextOutput(JSON.stringify({ result: 'success' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  var action = (e.parameter && e.parameter.action) || '';

  if (action === 'login') return jsonOut({ ok: isAdmin_(e) });
  if (action === 'getAllData') return jsonOut(getAllData_(e));
  if (action === 'proxyImage') return jsonOut(proxyImage_(e));
  if (action === 'getGroups') return jsonOut(getGroups_());
  if (action === 'addGroup') return jsonOut(addGroup_(e));
  if (action === 'editGroup') return jsonOut(editGroup_(e));
  if (action === 'deleteGroup') return jsonOut(deleteGroup_(e));
  if (action === 'getBehaviors') return jsonOut(getBehaviors_());
  if (action === 'addBehavior') return jsonOut(addBehavior_(e));

  return ContentService.createTextOutput('Apps Script ทำงานปกติ - ใช้ POST เพื่อบันทึกข้อมูล');
}

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function isAdmin_(e) {
  var user = (e.parameter['user'] || '').toString();
  var pass = (e.parameter['pass'] || '').toString();
  return user === ADMIN_USER && pass === ADMIN_PASS;
}

// the card image the admin pastes a link to can live on any host (Google
// Drive, Imgur, Facebook CDN, etc.), and most of those hosts don't send the
// CORS headers a browser needs to let JS on this page read the image bytes
// directly (fetch() gets silently blocked) - that's why "บันทึกภาพ" on the
// page could fail. This endpoint fetches the image server-side instead
// (Apps Script isn't subject to browser CORS rules) and hands the bytes
// back as base64 so the page can always build a real downloadable file,
// regardless of what the original image host allows.
function proxyImage_(e) {
  var url = (e.parameter['url'] || '').toString().trim();
  if (!url) return { ok: false, error: 'missing url' };
  try {
    var resp = UrlFetchApp.fetch(url, { muteHttpExceptions: true, followRedirects: true });
    if (resp.getResponseCode() !== 200) {
      return { ok: false, error: 'fetch failed: ' + resp.getResponseCode() };
    }
    var blob = resp.getBlob();
    return {
      ok: true,
      contentType: blob.getContentType() || 'image/png',
      base64: Utilities.base64Encode(blob.getBytes())
    };
  } catch (err) {
    return { ok: false, error: err.toString() };
  }
}

// ----- behavior groups (flexible majority/random matching) -----
// A "Groups" sheet holds named collections of behaviors, each with its own
// card image. Matching logic (see pickGroupCard() in teacher-room.html):
//   - if at least 2 of the visitor's 3 activities belong to the same group,
//     that group's card is shown outright (it's the clear majority - with
//     only 3 picks total, at most one group can ever reach 2).
//   - if the visitor's 3 picks are spread across different groups (no group
//     gets more than 1 match), the page randomly picks one of those
//     partially-matching groups' cards instead of showing nothing.
// All of that comparison logic runs client-side - this endpoint just
// stores/serves the raw group data.
function getGroupsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Groups');
  if (!sheet) {
    sheet = ss.insertSheet('Groups');
    sheet.appendRow(['GroupId', 'GroupName', 'Behaviors', 'ImageUrl']);
  }
  return sheet;
}

// returns every saved group that has a name, at least 1 behavior, and an image
function getGroups_() {
  var sheet = getGroupsSheet_();
  var rows = sheet.getDataRange().getValues();
  var groups = [];
  for (var i = 1; i < rows.length; i++) { // skip header row
    var groupId = (rows[i][0] || '').toString();
    var groupName = (rows[i][1] || '').toString().trim();
    var behaviors = (rows[i][2] || '').toString().split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    var imageUrl = (rows[i][3] || '').toString().trim();
    if (groupId && groupName && behaviors.length && imageUrl) {
      groups.push({ groupId: groupId, groupName: groupName, behaviors: behaviors, imageUrl: imageUrl });
    }
  }
  return groups;
}

// admin-only: add a new behavior group - unlimited count, at least 1 behavior required
function addGroup_(e) {
  if (!isAdmin_(e)) return { ok: false, error: 'unauthorized' };

  var groupName = (e.parameter['groupName'] || '').toString().trim();
  if (!groupName) return { ok: false, error: 'ต้องตั้งชื่อกลุ่ม' };

  var behaviors = (e.parameter['behaviors'] || '').toString().split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!behaviors.length) return { ok: false, error: 'ต้องเลือกพฤติกรรมอย่างน้อย 1 อย่าง' };

  var imageUrl = (e.parameter['imageUrl'] || '').toString().trim();
  if (!imageUrl) return { ok: false, error: 'ต้องใส่ลิงก์ภาพการ์ด' };

  var groupId = Utilities.getUuid();
  var sheet = getGroupsSheet_();
  sheet.appendRow([groupId, groupName, behaviors.join(','), imageUrl]);
  return { ok: true, groupId: groupId };
}

// admin-only: update an existing group's name, behaviors, and/or image -
// lets the admin fix a mistake or swap the card image without having to
// delete the group and lose its place in the list
function editGroup_(e) {
  if (!isAdmin_(e)) return { ok: false, error: 'unauthorized' };

  var groupId = (e.parameter['groupId'] || '').toString();
  if (!groupId) return { ok: false, error: 'ไม่พบกลุ่มนี้' };

  var groupName = (e.parameter['groupName'] || '').toString().trim();
  if (!groupName) return { ok: false, error: 'ต้องตั้งชื่อกลุ่ม' };

  var behaviors = (e.parameter['behaviors'] || '').toString().split(',').map(function (s) { return s.trim(); }).filter(Boolean);
  if (!behaviors.length) return { ok: false, error: 'ต้องเลือกพฤติกรรมอย่างน้อย 1 อย่าง' };

  var imageUrl = (e.parameter['imageUrl'] || '').toString().trim();
  if (!imageUrl) return { ok: false, error: 'ต้องใส่ลิงก์ภาพการ์ด' };

  var sheet = getGroupsSheet_();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toString() === groupId) {
      sheet.getRange(i + 1, 2, 1, 3).setValues([[groupName, behaviors.join(','), imageUrl]]);
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบกลุ่มนี้' };
}

// admin-only: remove one group by its GroupId
function deleteGroup_(e) {
  if (!isAdmin_(e)) return { ok: false, error: 'unauthorized' };

  var groupId = (e.parameter['groupId'] || '').toString();
  var sheet = getGroupsSheet_();
  var rows = sheet.getDataRange().getValues();
  for (var i = 1; i < rows.length; i++) {
    if ((rows[i][0] || '').toString() === groupId) {
      sheet.deleteRow(i + 1);
      return { ok: true };
    }
  }
  return { ok: false, error: 'ไม่พบกลุ่มนี้' };
}

// ----- custom behaviors -----
// The visitor's activity checklist starts with a fixed set of 15 built-in
// items (hardcoded in teacher-room.html), but the admin can add more from
// the dashboard - each new one is stored here and gets picked up by BOTH
// the visitor-facing checklist (so people can actually select it) and the
// admin's own group-building checklist (so it can be added to a group).
// getBehaviors is intentionally NOT admin-gated - regular visitors need to
// read this list too, to build their checklist.
function getBehaviorsSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName('Behaviors');
  if (!sheet) {
    sheet = ss.insertSheet('Behaviors');
    sheet.appendRow(['Name']);
  }
  return sheet;
}

// returns just the extra admin-added behavior names (the built-in 15 are
// not stored here - those already live directly in teacher-room.html)
function getBehaviors_() {
  var sheet = getBehaviorsSheet_();
  var rows = sheet.getDataRange().getValues();
  var names = [];
  for (var i = 1; i < rows.length; i++) { // skip header row
    var name = (rows[i][0] || '').toString().trim();
    if (name) names.push(name);
  }
  return names;
}

// admin-only: add one new custom behavior name
function addBehavior_(e) {
  if (!isAdmin_(e)) return { ok: false, error: 'unauthorized' };

  var name = (e.parameter['name'] || '').toString().trim();
  if (!name) return { ok: false, error: 'ต้องใส่ชื่อพฤติกรรม' };

  var existing = getBehaviors_();
  if (existing.indexOf(name) !== -1) return { ok: false, error: 'มีพฤติกรรมนี้อยู่แล้ว' };

  var sheet = getBehaviorsSheet_();
  sheet.appendRow([name]);
  return { ok: true };
}

// admin-only: every visitor row from Sheet1, as an array of objects
function getAllData_(e) {
  if (!isAdmin_(e)) return { ok: false, error: 'unauthorized' };

  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
  var rows = sheet.getDataRange().getValues();
  if (rows.length < 1) return { ok: true, rows: [] };

  var headers = ['SessionId', 'เวลา', 'Answer 1', 'Answer 2', 'Name1', 'Act1', 'Act2', 'Act3', 'Name2', 'Choose1'];
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var row = rows[i];
    var obj = {};
    for (var c = 0; c < headers.length; c++) {
      var val = row[c];
      obj[headers[c]] = (val instanceof Date) ? val.toString() : val;
    }
    out.push(obj);
  }
  return { ok: true, rows: out };
}
