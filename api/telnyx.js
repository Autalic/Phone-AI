import nodemailer from "nodemailer";

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

    if (!fromNumber) {
      return res.status(400).json({ error: "Missing caller number" });
    }

    // Format message
    const formattedNumber = fromNumber.includes('+1') ? 
      fromNumber.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4') : 
      fromNumber;

    let message = `📞 VOICEMAIL ALERT\n\n`;
    message += `From: ${formattedNumber}\n`;
    message += `Time: ${new Date().toLocaleString()}\n\n`;
    
    if (transcription) {
      message += `Message: "${transcription}"\n\n`;
    } else {
      message += `Message: [No transcription available]\n\n`;
    }
    
    if (recordingUrl) {
      message += `🎵 Recording: ${recordingUrl}\n\n`;
    }

    // Outlook.com SMTP (works with regular password, no app passwords needed)
    const transporter = nodemailer.createTransporter({
      host: 'smtp-mail.outlook.com',
      port: 587,
      secure: false,
      auth: {
        user: process.env.OUTLOOK_EMAIL, // yourname@outlook.com
        pass: process.env.OUTLOOK_PASSWORD, // regular password
      },
    });

    await transporter.sendMail({
      from: process.env.OUTLOOK_EMAIL,
      to: process.env.WORK_EMAIL, // your Google Workspace email
      subject: `📞 Voicemail from ${formattedNumber}`,
      text: message,
    });

    return res.status(200).json({ success: true, from: formattedNumber });

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({ 
      error: "Failed to send voicemail notification",
      details: error.message 
    });
  }
}
