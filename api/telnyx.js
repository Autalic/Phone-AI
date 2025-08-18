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

    // Parse payload - handle different Telnyx webhook structures
    const payload = req.body.data?.payload || req.body.payload || req.body;
    const fromNumber = payload.from || payload.from_number || payload.caller_id_number;
    const transcription = payload.transcription || payload.transcript || payload.message;
    const recordingUrl = payload.recording_url || payload.media_url;

    console.log("Parsed data:", { fromNumber, transcription, recordingUrl });

    if (!fromNumber) {
      console.error("No phone number found in payload");
      return res.status(400).json({ error: "Missing caller number" });
    }

    // Format phone number
    const formattedNumber = fromNumber.includes('+1') ? 
      fromNumber.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4') : 
      fromNumber;

    // Create email content
    let message = `📞 VOICEMAIL ALERT\n\n`;
    message += `From: ${formattedNumber}\n`;
    message += `Time: ${new Date().toLocaleString()}\n\n`;
    
    if (transcription && transcription.trim()) {
      message += `Message: "${transcription}"\n\n`;
    } else {
      message += `Message: [No transcription available]\n\n`;
    }
    
    if (recordingUrl) {
      message += `🎵 Recording: ${recordingUrl}\n\n`;
    }

    console.log("Environment check:", {
      hasOutlookEmail: !!process.env.OUTLOOK_EMAIL,
      hasOutlookPassword: !!process.env.OUTLOOK_PASSWORD,
      hasWorkEmail: !!process.env.WORK_EMAIL
    });

    // Verify environment variables
    if (!process.env.OUTLOOK_EMAIL || !process.env.OUTLOOK_PASSWORD || !process.env.WORK_EMAIL) {
      return res.status(500).json({ 
        error: "Missing environment variables",
        missing: {
          OUTLOOK_EMAIL: !process.env.OUTLOOK_EMAIL,
          OUTLOOK_PASSWORD: !process.env.OUTLOOK_PASSWORD,
          WORK_EMAIL: !process.env.WORK_EMAIL
        }
      });
    }

    console.log("Creating Outlook SMTP transporter...");

    // Create transporter with Outlook SMTP - CORRECT METHOD NAME
    const transporter = nodemailer.createTransport({
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false, // Use STARTTLS
      auth: {
        user: process.env.OUTLOOK_EMAIL,
        pass: process.env.OUTLOOK_PASSWORD,
      },
    });

    console.log("Sending email...");
    const info = await transporter.sendMail({
      from: process.env.OUTLOOK_EMAIL,
      to: process.env.WORK_EMAIL,
      subject: `📞 Voicemail from ${formattedNumber}`,
      text: message,
    });

    console.log("Email sent successfully:", info.messageId);

    return res.status(200).json({ 
      success: true, 
      from: formattedNumber,
      messageId: info.messageId 
    });

  } catch (error) {
    console.error("Detailed error:", {
      message: error.message,
      code: error.code,
      command: error.command,
      stack: error.stack
    });
    
    return res.status(500).json({ 
      error: "Failed to send voicemail notification",
      details: error.message,
      code: error.code || 'UNKNOWN_ERROR'
    });
  }
}
