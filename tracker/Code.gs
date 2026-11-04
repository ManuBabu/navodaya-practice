/**
 * Target Navodaya: usage tracker.
 * Paste this into Extensions > Apps Script of a PRIVATE Google Sheet, then deploy it as a web app
 * (Execute as: Me, Who has access: Anyone). The app sends a short note here when a student opens it,
 * starts or finishes a test, and once a minute while it is open.
 *
 * It keeps two tabs:
 *   Users    - one row per phone: name, mobile, Online now, last seen, tests, quizzes, last score
 *   Activity - one row per event: time, name, what happened, score details
 */

const ONLINE_MINUTES = 3;   // seen in the last 3 minutes = "Online"

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!d.device) return text("missing device");
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const users = tab(ss, "Users", ["Name", "Mobile", "Status", "Last seen", "First seen", "Full tests", "Quick quizzes", "Last score", "Device"]);
    const activity = tab(ss, "Activity", ["Time", "Name", "Event", "Details", "Device"]);
    const now = new Date();
    const name = String(d.name || "").slice(0, 60);
    const phone = String(d.phone || "").replace(/\D/g, "").slice(0, 10);

    // find this phone's row in Users, or add one
    const last = users.getLastRow();
    const devices = last > 1 ? users.getRange(2, 9, last - 1, 1).getValues().map(r => r[0]) : [];
    let row = devices.indexOf(d.device);
    if (row < 0) {
      row = last + 1;
      users.getRange(row, 1, 1, 9).setValues([[name, phone ? "'" + phone : "", "", now, now, 0, 0, "", d.device]]);
      users.getRange(row, 3).setFormula('=IF(NOW()-D' + row + '<' + ONLINE_MINUTES + '/1440,"🟢 Online","")');
    } else {
      row += 2;
      users.getRange(row, 1, 1, 2).setValues([[name, phone ? "'" + phone : ""]]);
      users.getRange(row, 4).setValue(now);
    }
    if (d.event === "test_finish") users.getRange(row, 6).setValue((Number(users.getRange(row, 6).getValue()) || 0) + 1);
    if (d.event === "quiz_finish") users.getRange(row, 7).setValue((Number(users.getRange(row, 7).getValue()) || 0) + 1);
    if (d.score) users.getRange(row, 8).setValue(String(d.score).slice(0, 200));

    // log everything except the once-a-minute "still here" pings
    if (d.event !== "ping") activity.appendRow([now, name, String(d.event || ""), String(d.details || "").slice(0, 300), d.device]);
    return text("ok");
  } catch (err) {
    return text("error: " + err);
  } finally {
    lock.releaseLock();
  }
}

function doGet() {
  return text("Target Navodaya tracker is running.");
}

function tab(ss, name, header) {
  let s = ss.getSheetByName(name);
  if (!s) {
    s = ss.insertSheet(name);
    s.appendRow(header);
    s.setFrozenRows(1);
    s.getRange(1, 1, 1, header.length).setFontWeight("bold").setBackground("#e3f1ec");
    if (name === "Users") { s.getRange("D:E").setNumberFormat("d mmm yyyy, h:mm am/pm"); s.setColumnWidth(8, 320); }
    if (name === "Activity") { s.getRange("A:A").setNumberFormat("d mmm yyyy, h:mm am/pm"); s.setColumnWidth(4, 360); }
    // keep the "Online" column fresh even when nobody writes to the sheet
    ss.setRecalculationInterval(SpreadsheetApp.RecalculationInterval.MINUTE);
    const first = ss.getSheetByName("Sheet1");
    if (first && first.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(first);
  }
  return s;
}

function text(t) {
  return ContentService.createTextOutput(t).setMimeType(ContentService.MimeType.TEXT);
}
