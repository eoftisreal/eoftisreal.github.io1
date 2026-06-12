const { Resend } = require('resend');
const env = require('../config/env');

const resend = env.resendApiKey ? new Resend(env.resendApiKey) : null;

async function sendEmail({ from, to, subject, html }) {
  const sender = from || env.emailFrom;

  if (!resend) {
    console.log(`[Resend Skipped] From: ${sender} | To: ${to} | Subject: ${subject}`);
    console.log(`[Content] ${html}`);
    return { skipped: true, reason: 'RESEND_API_KEY not configured' };
  }

  try {
    await resend.emails.send({
      from: sender,
      to,
      subject,
      html,
    });
    return { skipped: false };
  } catch (error) {
    // We log the error but do NOT throw it.
    // Throwing it would completely abort the calling transaction (e.g. signup),
    // causing a 500 error for the user even if their account was successfully created.
    console.error('Failed to send email via Resend (check your API key and verified domains):', error.message);
    return { skipped: true, error: error.message };
  }
}

const STORE_NAME = "Kapda Kraft";
const LOGO_URL = "https://pub-8c7eefa9a8044a569bef9e3d0b743d59.r2.dev/web%20logo.png";

function generateEmailTemplate(title, message, buttonText, buttonUrl, expirationNotice = "") {
  return `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #333333;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${LOGO_URL}" alt="${STORE_NAME}" style="max-height: 50px; object-fit: contain;" />
      </div>

      <div style="background-color: #f9f9f9; padding: 40px; border-radius: 8px; text-align: center; border: 1px solid #eeeeee;">
        <h1 style="margin-top: 0; color: #111111; font-size: 24px;">${title}</h1>
        <p style="font-size: 16px; line-height: 1.5; margin-bottom: 30px; color: #555555;">
          ${message}
        </p>

        <a href="${buttonUrl}" style="display: inline-block; background-color: #000000; color: #ffffff; text-decoration: none; padding: 14px 28px; font-weight: bold; border-radius: 4px; font-size: 16px;">
          ${buttonText}
        </a>

        ${expirationNotice ? `<p style="margin-top: 30px; font-size: 13px; color: #888888;">${expirationNotice}</p>` : ''}
      </div>

      <div style="text-align: center; margin-top: 30px; font-size: 12px; color: #999999;">
        <p>If you did not request this email, you can safely ignore it.</p>
        <p>&copy; ${new Date().getFullYear()} ${STORE_NAME}. All rights reserved.</p>
      </div>
    </div>
  `;
}

async function sendVerificationEmail(email, verifyUrl) {
  const html = generateEmailTemplate(
    "Verify your account",
    `Welcome to ${STORE_NAME}! To complete your registration and secure your account, please verify your email address by clicking the button below.`,
    "Verify Email",
    verifyUrl,
    "This verification link will expire in 24 hours."
  );

  return sendEmail({
    from: env.emailFromAuth,
    to: email,
    subject: `Verify your account - ${STORE_NAME}`,
    html,
  });
}

async function sendMagicLinkEmail(email, magicUrl) {
  const html = generateEmailTemplate(
    "Your Login Link",
    `Welcome back to ${STORE_NAME}! Click the button below to securely log into your account without a password.`,
    "Log In Now",
    magicUrl,
    "This magic link will expire in 15 minutes and can only be used once."
  );

  return sendEmail({
    from: env.emailFromAuth,
    to: email,
    subject: `Login to ${STORE_NAME}`,
    html,
  });
}

async function sendPasswordResetEmail(email, resetUrl) {
  const html = generateEmailTemplate(
    "Reset Password",
    "We received a request to reset your password. If you made this request, please click the button below to set a new password.",
    "Reset Password",
    resetUrl,
    "This password reset link will expire in 1 hour."
  );

  return sendEmail({
    from: env.emailFromAuth,
    to: email,
    subject: `Reset your password - ${STORE_NAME}`,
    html,
  });
}

async function sendOrderConfirmationEmail(order, userEmail) {
  const itemsHtml = order.items.map(item => `
    <tr>
      ${item.customImage ? `<td style="padding: 10px; border-bottom: 1px solid #eee;"><img src="${item.customImage}" alt="${item.title}" style="max-width: 100px; max-height: 100px; border-radius: 4px;" /></td>` : '<td style="padding: 10px; border-bottom: 1px solid #eee;"></td>'}
      <td style="padding: 10px; border-bottom: 1px solid #eee;"><strong>${item.title}</strong><br>Qty: ${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee; text-align: right;">₹${(item.quantity * item.unitPrice).toFixed(2)}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #ffffff; color: #333333;">
      <div style="text-align: center; margin-bottom: 30px;">
        <img src="${LOGO_URL}" alt="${STORE_NAME}" style="max-height: 50px; object-fit: contain;" />
      </div>
      <h1 style="color: #111111; font-size: 24px; text-align: center;">Order Confirmation</h1>
      <p>Thank you for your order! Your order ID is <strong>#${order._id.toString().slice(-6)}</strong>.</p>

      <h2 style="color: #555; margin-top: 30px;">Shipping Details</h2>
      <p style="background: #f9f9f9; padding: 15px; border-radius: 5px;">
        ${order.shippingAddress.line1}<br>
        ${order.shippingAddress.line2 ? order.shippingAddress.line2 + '<br>' : ''}
        ${order.shippingAddress.city}, ${order.shippingAddress.state} ${order.shippingAddress.postalCode}<br>
        ${order.shippingAddress.country}
      </p>

      <h2 style="color: #555; margin-top: 30px;">Order Summary</h2>
      <table style="width: 100%; border-collapse: collapse;">
        ${itemsHtml}
      </table>

      <div style="text-align: right; margin-top: 20px;">
        <p>Subtotal: ₹${order.subtotal.toFixed(2)}</p>
        ${order.discount > 0 ? `<p style="color: green;">Discount: -₹${order.discount.toFixed(2)}</p>` : ''}
        <p>Tax: ₹${order.tax.toFixed(2)}</p>
        ${order.deliveryCharge > 0 ? `<p>Delivery: ₹${order.deliveryCharge.toFixed(2)}</p>` : ''}
        <h3 style="color: #333; font-size: 1.2em;">Total: ₹${order.total.toFixed(2)}</h3>
      </div>

      <p style="margin-top: 30px; font-size: 0.9em; color: #777;">You will receive another update once your payment is verified and the order is processed.</p>
    </div>
  `;

  return sendEmail({
    from: env.emailFromOrders,
    to: userEmail,
    subject: `Order Confirmation - #${order._id.toString().slice(-6)}`,
    html,
  });
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendOrderConfirmationEmail,
};
