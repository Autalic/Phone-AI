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

    console.log("AI Assistant webhook received:", JSON.stringify(req.body, null, 2));

    // For AI Assistant tool webhooks, data comes directly in req.body
    const { caller_name, caller_phone, message, call_time } = req.body;

    console.log("Parsed data:", { caller_name, caller_phone, message, call_time });

    if (!message) {
      return res.status(400).json({ error: "Missing message" });
    }

    // Format phone number if provided
    const formattedNumber = caller_phone ? 
      (caller_phone.includes('+1') ?
        caller_phone.replace(/(\+1)(\d{3})(\d{3})(\d{4})/, '$1 ($2) $3-$4') :
        caller_phone) : 
      'Not provided';

    // Create email content
    let emailText = `📞 NEW VOICEMAIL\n\n`;
    emailText += `From: ${caller_name || 'Not provided'}\n`;
    emailText += `Phone: ${formattedNumber}\n`;
    emailText += `Time: ${call_time || new Date().toLocaleString()}\n\n`;
    emailText += `MESSAGE:\n"${message}"\n\n`;
    emailText += `---\nRauch Architectural Designers Answering Service`;

    console.log("Setting up email transporter...");
    let transporter;

    // Check if we have custom SMTP settings (like Brevo)
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      console.log("Using custom SMTP:", process.env.SMTP_HOST);
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS,
        },
      });

      console.log("Sending email to:", process.env.WORK_EMAIL);
      const info = await transporter.sendMail({
        from: `"Rauch Answering Service" <${process.env.SMTP_USER}>`,
        to: process.env.WORK_EMAIL,
        subject: `📞 Message from ${caller_name || formattedNumber}`,
        text: emailText,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a73e8; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">📞 New Message</h1>
              <p style="margin: 5px 0 0 0;">Rauch Architectural Designers</p>
            </div>
            <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
              <p><strong>From:</strong> ${caller_name || 'Not provided'}</p>
              <p><strong>Phone:</strong> ${formattedNumber}</p>
              <p><strong>Time:</strong> ${call_time || new Date().toLocaleString()}</p>
              <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>Message:</strong><br>
                <em>"${message}"</em>
              </div>
            </div>
          </div>
        `
      });

      console.log("Email sent successfully to work email!");
      return res.status(200).json({
        success: true,
        from: formattedNumber,
        messageId: info.messageId,
        sentTo: process.env.WORK_EMAIL,
        service: "Custom SMTP"
      });

    } else {
      // Fallback to test account
      console.log("No SMTP config found, using test account...");
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
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
        from: `"Rauch Answering Service" <${testAccount.user}>`,
        to: process.env.WORK_EMAIL || 'test@example.com',
        subject: `📞 Message from ${caller_name || formattedNumber}`,
        text: emailText,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: #1a73e8; color: white; padding: 20px; border-radius: 8px 8px 0 0;">
              <h1 style="margin: 0;">📞 New Message</h1>
              <p style="margin: 5px 0 0 0;">Rauch Architectural Designers</p>
            </div>
            <div style="border: 1px solid #ddd; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
              <p><strong>From:</strong> ${caller_name || 'Not provided'}</p>
              <p><strong>Phone:</strong> ${formattedNumber}</p>
              <p><strong>Time:</strong> ${call_time || new Date().toLocaleString()}</p>
              <div style="background: #f0f8ff; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong>Message:</strong><br>
                <em>"${message}"</em>
              </div>
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
        note: "Using test service - add SMTP config for real delivery"
      });
    }

  } catch (error) {
    console.error("Error:", error);
    return res.status(500).json({
      error: "Failed to send voicemail notification",
      details: error.message
    });
  }
}
