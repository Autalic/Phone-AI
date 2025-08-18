const nodemailer = require("nodemailer");

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    console.log("Telnyx webhook received:", JSON.stringify(req.body, null, 2));

    // Parse payload
    const payload = req.body.data?.payload || req.body.payload || req.body;
    const fromNumber = payload.from || payload.from_number || payload.caller_id_number;
    const transcription = payload.transcription || payload.transcript || payload.message;
    const recordingUrl = payload.recording_url || payload.media_url;

    console.log("Parsed data:", { fromNumber, transcription, recordingUrl });

    if (!fromNumber) {
      return res.status(400).json({ error: "Missing caller number" });
    }

    // Format phone number
    const formattedNumber = fromNumber.includes('+1') ? 
      fromNumber.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4') : 
      fromNumber;

    // Create email content
    let emailText = `📞 NEW VOICEMAIL\n\n`;
    emailText += `From: ${formattedNumber}\n`;
    emailText += `Time: ${new Date().toLocaleString()}\n\n`;
    
    if (transcription && transcription.trim()) {
      emailText += `MESSAGE:\n"${transcription}"\n\n`;
    } else {
      emailText += `MESSAGE: No transcription available\n\n`;
    }
    
    if (recordingUrl) {
      emailText += `🎵 Listen: ${recordingUrl}\n\n`;
    }

    emailText += `---\nTelnyx Voicemail System`;

    console.log("Creating test email account...");

    // Create a test account using Ethereal Email
    const testAccount = await nodemailer.createTestAccount();
    
    const transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log("Sending email via test account:", testAccount.user);

    const info = await transporter.sendMail({
      from: `"Voicemail System" <${testAccount.user}>`,
      to: process.env.WORK_EMAIL || 'test@example.com',
      subject: `📞 Voicemail from ${formattedNumber}`,
      text: emailText,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: #1a73e8; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0;">📞 New Voicemail</h1>
          </div>
          <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
            <p><strong>From:</strong> ${formattedNumber}</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            ${transcription ? `
              <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>Message:</strong><br>
                <em>"${transcription}"</em>
              </div>
            ` : '<p><em>No transcription available</em></p>'}
            ${recordingUrl ? `
              <p><a href="${recordingUrl}" style="background: #1a73e8; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">🎵 Listen to Recording</a></p>
            ` : ''}
          </div>
        </div>
      `
    });

    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log("Email sent! Preview URL:", previewUrl);
    
    return res.status(200).json({ 
      success: true, 
      from: formattedNumber,
      messageId: info.messageId,
      previewUrl: previewUrl,
      note: "Email sent via test service - click previewUrl to see the email"
    });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ 
      error: "Failed to send voicemail notification",
      details: error.message
    });
  }
}
