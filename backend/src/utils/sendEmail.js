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

async function sendVerificationEmail(email, verifyUrl) {
  return sendEmail({
    from: env.emailFromAuth,
    to: email,
    subject: 'Verify your account',
    html: `<h1>Verify Email</h1><a href="${verifyUrl}">Verify Account</a>`,
  });
}

async function sendMagicLinkEmail(email, magicUrl) {
  return sendEmail({
    from: env.emailFromAuth,
    to: email,
    subject: 'Login Link',
    html: `<a href="${magicUrl}">Login</a>`,
  });
}

async function sendPasswordResetEmail(email, resetUrl) {
  return sendEmail({
    from: env.emailFromAuth,
    to: email,
    subject: 'Reset Password',
    html: `<a href="${resetUrl}">Reset Password</a>`,
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
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333;">Order Confirmation</h1>
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
    from: env.emailFrom,
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
