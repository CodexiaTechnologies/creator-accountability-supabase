// Import the 'serve' function from the Deno standard library.
// This is used to create an HTTP server in a Deno environment.
import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
//import { serve } from "https://deno.land/std@0.192.0/http/server.ts";

// Import Nodemailer directly from npm via Deno's npm: specifier
// Deno will manage downloading and caching this npm package
import nodemailer from "npm:nodemailer";

// Define the handler function for the Edge Function.
// This function will be called when the Edge Function receives an HTTP request.
serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    // Parse the JSON payload from the incoming request.
    // For a Supabase database webhook, this payload will contain information about the database event (e.g., INSERT).
    const payload = await req.json();

    console.log('payload record', payload.record);
    // Extract the 'record' from the payload. This 'record' contains the new row data that was inserted.
    const newRecord = payload.record;


    const header = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirmation Email</title>

  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@100..900&family=Poppins:ital,wght@0,100;0,200;0,300;0,400;0,500;0,600;0,700;0,800;0,900;1,100;1,200;1,300;1,400;1,500;1,600;1,700;1,800;1,900&family=Tajawal:wght@200;300;400;500;700;800;900&display=swap');

    body {
      margin: 0;
      font-family: 'Montserrat', sans-serif;
      background-color: #f2f8fb;
      color: #333;
    }

    .container {
      max-width: 430px;
      margin: 0 auto;
      background-color: #fff;
      border: 1px solid #ddd;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
    }

    .header {
      background-color: #00AEEF;
      padding: 12px 16px;
    }

    .content {
      padding: 20px;
      background: #edf6fa;
    }

    h2 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 15px;
    }

    .greeting {
      margin-bottom: 20px;
    }

    p {
      font-size: 14px;
      font-weight: 500;
      color: #4F4F4F;
    }

    .reference-box {
      background-color: #222;
      color: #fff;
      padding: 12px;
      text-align: center;
      border-radius: 6px;
      font-weight: 600;
      font-size: 14px;
      margin: 20px 0;
      letter-spacing: 0.5px;
    }

    .summary-box {
      border: 1px solid #ccc;
      border-radius: 8px;
      padding: 12px 16px;
      background-color: #fff;
      margin-bottom: 20px;
      color: #222222 !important;
    }

    .summary-row {
      padding: 4px 0;
      font-size: 12px;
      font-weight: 500;
    }
          td{
      padding: 3px 0;
    }

    a {
      color: #00AEEF;
      text-decoration: none;
    }

    .regards-text {
      font-weight: 400;
      /* letter-spacing: 1.1px; */
      line-height: 1.3;
    }

    .footer {
      text-align: center;
      font-size: 14px;
      font-weight: 500;
      padding: 20px 16px;
      background-color: #fff;
    }

    .copyright {
      background-color: #00AEEF;
      color: white;
      text-align: center;
      padding: 18px 16px;
      font-weight: 500;
      font-size: 14px;
    }

    @media screen and (max-width: 480px) {
      .container {
        border-radius: 0;
      }
    }
  </style>

</head>
<body>
  <div class="container">
    <div class="header">
      <img class="logo" src="https://eduxia.codexia.tech/Centerted.png" style="max-height:80px" alt="NMDC Logo" />
    </div>

    <div class="content">`

    const footer = ` <p class="regards-text"><strong>Warm regards,</strong><br />The NMDC Team<br />IMAALGELI Mobile
        Platform<br />info@nmdcs.com</p>
    </div>

    <div class="copyright">@2025 IMAALGELI</div>
  </div>
</body>

</html>`

    const requestHTML = `<div class="reference-box">${newRecord.reference_number}</div>
      <div class="summary-box">
        <table width="100%" border="0" cellspacing="0" cellpadding="0">
          <tbody>
            <tr class="summary-row">
              <td style="width: 40%;">Name:</td>
              <td style="width: 60%; text-align: right;">${newRecord.name}</td>
            </tr>
            <tr class="summary-row">
              <td style="width: 40%;">Email:</td>
              <td style="width: 60%; text-align: right;">${newRecord.email}</td>
            </tr>
            <tr class="summary-row">
              <td style="width: 40%;">Location:</td>
              <td style="width: 60%; text-align: right;">${newRecord.country}</td>
            </tr>
            <tr class="summary-row">
              <td style="width: 40%;">Phone No:</td>
              <td style="width: 60%; text-align: right;">${newRecord.phone}</td>
            </tr>
            <tr class="summary-row">
              <td style="width: 50%;">Number of Shares:</td>
              <td style="width: 50%; text-align: right;">${newRecord.shares_requested}</td>
            </tr>
            <tr class="summary-row">
              <td style="width: 50%;">Price Per Share:</td>
              <td style="width: 50%; text-align: right;">$${newRecord.price_per_share}</td>
            </tr>
            <tr class="summary-row">
              <td style="width: 50%;">Total Shares:</td>
              <td style="width: 50%; text-align: right;">$${(newRecord.shares_requested * newRecord.price_per_share).toFixed(2)}</td>
            </tr>
          </tbody>
        </table>
      </div>`

    const userGreeting = ` <h2>Confirmation Email</h2>
    <div class="greeting">
        <p><strong>Dear ${newRecord.name},</strong></p>
        <p>
          Thank you for registering your interest in owning shares with
          <strong>New Mogadishu Development Corporation (NMDC)</strong> through
          the IMAALGELI app.
        </p>
        <p>
          Your submission has been received successfully and your Reference no is:
        </p>
      </div>`

      const adminGreeting = `<div class="greeting">
      <p><strong>Dear Admin,</strong></p>
<p>
  A new investor <strong>${newRecord.name}</strong> has submitted their interest in owning shares with
  <strong>New Mogadishu Development Corporation (NMDC)</strong> through the IMAALGELI app.
</p>
<p>
  The submission has been received successfully. Below are the details:
</p></div>`

const userHelpHTML = `<p>Our team will review your submission and contact you if further information is needed.</p>
      <p>
        If you have any questions, feel free to reach out to us via our website:
        <br />
        <a href="https://nmdcs.com">https://nmdcs.com</a>
      </p>`

    const userFullHtml = `${header}${userGreeting}${requestHTML}${userHelpHTML}${footer}`;
    const adminFullHtml = `${header}${adminGreeting}${requestHTML}${footer}`;

    const SMTP = {
      name: "Imaalgeli App",
      host: 'premium154.web-hosting.com',
      port: 465,
      secure: true, // true for 465, false for other ports
      auth: {
        user: "noreply@codexiatech.com",
        pass: "D65hj)OcLas0"
      },
      tls: {
        // do not fail on invalid certs
        rejectUnauthorized: false
      }
    }

  const transporter = nodemailer.createTransport(SMTP);

  const userData = {
      from: '"Creator Accountability App" <noreply@codexiatech.com>',
      to: "asimilyas527@gmail.com",
      subject: `Confirmation: Your Shares Request Has Been Received`,
      html: userFullHtml,
      text: `Confirmation: Your Shares Request Has Been Received`,
    };

      const adminData = {
      from: '"Creator Accountability App" <noreply@codexiatech.com>',
      to: "asimilyas527@gmail.com",
      subject: `New Submission Alert: ${newRecord.name} Requested ${newRecord.shares_requested} Shares`,
      html: adminFullHtml,
      text: `New Submission Alert: ${newRecord.name} Requested ${newRecord.shares_requested} Shares`,
    };

      transporter.sendMail(userData, (error, info) => {
        console.log( 'user:', info);
        console.log( 'user:', error);
      });

      transporter.sendMail(adminData, (error, info) => {
        console.log( 'admin', info);
        console.log( 'admin', error);
      });

    return new Response("Email sent successfully", { status: 200 });

  } catch (error) {
    console.error("Error processing sending email request :", error);
    return new Response(`Internal Server Error: ${error.message}`, { status: 500 });
  }
});