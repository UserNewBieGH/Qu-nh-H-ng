/**
 * Google Apps Script endpoint for Cô Tư Hẻm bookings.
 * 1. Create a Google Sheet and set its ID in Script Properties as SPREADSHEET_ID.
 * 2. Deploy this project as a Web App, execute as you, allow access to anyone.
 * 3. Copy the Web App URL into config.js as window.SHEETS_WEBHOOK.
 */
function doPost(e) {
  var data = JSON.parse(e.postData.contents || "{}");
  var id = PropertiesService.getScriptProperties().getProperty("SPREADSHEET_ID");
  if (!id) throw new Error("Missing SPREADSHEET_ID in Script Properties");
  var book = SpreadsheetApp.openById(id);
  var sheet = book.getSheetByName("DonTour") || book.insertSheet("DonTour");
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Mã đơn", "Họ tên", "SĐT/Zalo", "Email", "Ngày đi", "Khung giờ", "Số khách", "Tổng tiền", "Thanh toán", "Nguồn", "Chiến dịch", "Hộ chiếu", "Ghi chú", "Tạo lúc"]);
  }
  sheet.appendRow([
    data.code, data.name, data.phone, data.email, data.date, data.time, data.guests, data.amount, data.payment,
    data.source && data.source.utm_source || "Trực tiếp",
    data.source && data.source.utm_campaign || "",
    data.persona, data.notes || "", data.createdAt || new Date().toISOString()
  ]);
  var emailStatus = "not_sent";
  try {
    MailApp.sendEmail({
      to: data.email,
      subject: "Cô Tư đã nhận yêu cầu giữ chỗ " + data.code,
      body: "Chào " + data.name + ",\n\nCô Tư đã nhận yêu cầu giữ " + data.guests + " chỗ cho ngày " + data.date + " (" + data.time + ").\n" +
        "Hộ chiếu của bạn: " + data.persona + ".\nTổng tiền dự kiến: " + Number(data.amount).toLocaleString("vi-VN") + "đ.\n\nHẹn gặp bạn lúc 16:30!\nCô Tư Hẻm"
    });
    emailStatus = "sent";
  } catch (err) {
    emailStatus = "failed: " + err.message;
  }
  return ContentService.createTextOutput(JSON.stringify({ ok: true, code: data.code, emailStatus: emailStatus }))
    .setMimeType(ContentService.MimeType.JSON);
}
