// Bound legacy Tech Ticket workbook sender. Only the Mario guard differs from the original.
function sendTechTicketEmails() {
  // Only Mario may choose and contact outside recipients. Student techs escalate in NEST.
  var escalationActor = String(Session.getActiveUser().getEmail() || '').trim().toLowerCase();
  if (!['mpenalver@bethelsd.org','mario@memberhq.net','astramario@gmail.com'].includes(escalationActor)) {
    SpreadsheetApp.getUi().alert('Only Mario may send an outside escalation. Use the NEST Software Tech workspace to escalate this ticket to Mario for review.');
    return;
  }
  var ui = SpreadsheetApp.getUi();
  var sheetUrl = 'https://docs.google.com/spreadsheets/d/169SCXhVH1ufehSUSv_qkbVBJhrdz4MVAjBMOUfDBMGg/edit';
  var techTicketsSheetName = 'TechTickets';
  var defaultRecipient = 'support@bethelsd.org';

  var ss = SpreadsheetApp.openByUrl(sheetUrl);
  var sheet = ss.getSheetByName(techTicketsSheetName);
  var lastRow = sheet.getLastRow();

  if (lastRow < 2) {
    Logger.log('No data rows found in TechTickets sheet.');
    return;
  }

  var dataRange = sheet.getRange('C2:I' + lastRow);
  var data = dataRange.getValues();

  Logger.log('Starting execution for sendTechTicketEmails(). Processing %s rows.', data.length);

  data.forEach(function(row, index) {
    var rowNumber = index + 2;
    var status = sheet.getRange('B' + rowNumber).getValue();

    if (status === 'Forward to Tech') {
      Logger.log('[Row %s] Detected status "Forward to Tech".', rowNumber);

      // Extract raw data from columns C through I
      var studentIdentifier = row[1]; // Column D (Student Name or Email)
      var studentDivision   = row[2]; // Column E
      var computerDetails   = row[3] ? String(row[3]) : ''; // Column F
      var issueSummary      = row[4] ? String(row[4]) : 'Tech Issue Reported'; // Column G
      var problemDescription = row[5] ? String(row[5]) : 'No description provided.'; // Column H
      var linkToImages       = row[6] ? String(row[6]) : ''; // Column I
      var subject            = issueSummary;

      // Prompt 1: Confirm action
      var response = ui.alert(
        'Forward to Tech Services',
        'Would you like to forward the Tech Service request for row ' + rowNumber + '?',
        ui.ButtonSet.YES_NO
      );

      if (response === ui.Button.YES) {
        // Prompt 2: Ask for target email address
        var recipientPrompt = ui.prompt(
          'Enter Recipient Email',
          'Please enter the email address for row ' + rowNumber +
          ' to send to, or leave blank to use default (' + defaultRecipient + '):',
          ui.ButtonSet.OK_CANCEL
        );

        // If user cancelled prompt, log and skip sending
        if (recipientPrompt.getSelectedButton() === ui.Button.CANCEL) {
          Logger.log('[Row %s] User cancelled recipient prompt. Email NOT sent.', rowNumber);
          return;
        }

        var typedRecipient = recipientPrompt.getResponseText().trim();
        var finalRecipient = typedRecipient !== '' ? typedRecipient : defaultRecipient;

        Logger.log('[Row %s] Recipient designated: %s', rowNumber, finalRecipient);

        // Format station details table
        var computerDetailsArray = computerDetails ? computerDetails.split(', ') : [];
        var tableRows = computerDetailsArray.map(function(detail) {
          var parts = detail.split(';');
          var station = parts.length > 0 ? parts[0].trim().replace(/Station /i, '') : "Unknown";
          var serial  = parts.length > 1 ? parts[1].trim().replace(/BSD Serial Number /i, '') : "Unknown";
          return '<tr><td style="padding: 4px 8px;">' + station + '</td><td style="padding: 4px 8px;">' + serial + '</td></tr>';
        }).join('');

        var htmlBody =
          '<p>Hello Tech Department!</p>' +
          '<p>' + studentIdentifier + ', from NEST™ ' + studentDivision + ' division, is reporting a tech issue at the following computer station(s):</p>' +
          '<table border="1" style="border-collapse: collapse; margin-left: 2em;">' +
          '<tr><th>Station Number</th><th>Bethel Barcode</th></tr>' +
          tableRows +
          '</table>' +
          '<p>The issue being reported is: ' + problemDescription + '</p>' +
          (linkToImages ? '<p>Here are images to illustrate the issue: <a href="' + linkToImages + '">View Attachment</a>.</p>' : '') +
          '<p>Please address this issue at your earliest convenience.</p>' +
          '<p>Sincerely,<br>NEST™ Software Tech Team.</p>';

        try {
          // Send Email
          MailApp.sendEmail({
            to: finalRecipient,
            subject: subject,
            htmlBody: htmlBody
          });

          // Update Status to Pending
          sheet.getRange('B' + rowNumber).setValue('Pending');

          Logger.log('[Row %s] SUCCESS: Email successfully sent to "%s". Status changed to "Pending".', rowNumber, finalRecipient);

          // Show onscreen confirmation
          ui.alert('Success', 'Email successfully sent to: ' + finalRecipient, ui.ButtonSet.OK);

        } catch (err) {
          Logger.log('[Row %s] ERROR: Failed to send email to "%s". Details: %s', rowNumber, finalRecipient, err.toString());
          ui.alert('Email Failed', 'Could not send email to ' + finalRecipient + '.\nError: ' + err.message, ui.ButtonSet.OK);
        }

      } else if (response === ui.Button.NO) {
        Logger.log('[Row %s] User selected NO. Resetting status column B to empty.', rowNumber);
        sheet.getRange('B' + rowNumber).setValue('');
      }
    }
  });

  Logger.log('Execution finished for sendTechTicketEmails().');
}
