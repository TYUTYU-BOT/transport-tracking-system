export async function sendSms(phoneNumber, message) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    throw new Error("SMS is not configured. Set the Twilio account SID, auth token, and sender number.");
  }

  const body = new URLSearchParams({ To: phoneNumber, From: fromNumber, Body: message });
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });

  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.message || `SMS provider returned ${response.status}`);
  }
}
