import { getBablastCredentials } from '../src/services/communication/communication.config';

async function main() {
  console.log("=== BABLAST DEEP AUDIT SCRIPT ===");
  try {
    const creds = await getBablastCredentials();
    if (!creds.isConfigured) {
      console.log("Error: Bablast API Key is not configured.");
      return;
    }
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${creds.apiKey}`
    };

    console.log("\n--- EXPERIMENT 1: VERIFY SEND ---");
    try {
      const payload = {
        phone: '6282211700060', // Send to self as test recipient
        message: 'Test LTMS menggunakan sender_code Bablast (8G710FV6)',
        sender_code: '8G710FV6'
      };
      console.log("Payload:", payload);
      const res = await fetch(`${creds.baseUrl}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      console.log("HTTP Status:", res.status);
      console.log("Response JSON:", JSON.stringify(data, null, 2));
    } catch (e: any) {
      console.log("Exp 1 Error:", e.message);
    }

    console.log("\n--- EXPERIMENT 2: SENDER DISCOVERY ---");
    try {
      const res = await fetch(`${creds.baseUrl}/senders`, {
        method: 'GET',
        headers
      });
      const data = await res.json().catch(() => ({}));
      console.log("HTTP Status:", res.status);
      // Filter out only relevant sender to keep logs clean
      const senders = data.data || data;
      console.log("Found Senders Array Length:", Array.isArray(senders) ? senders.length : 'Not an array');
      if (Array.isArray(senders)) {
        const matchingSenders = senders.filter((s: any) => s.phone === '6282211700060' || s.phone === '+6282211700060' || s.sender_code === '8G710FV6');
        console.log("Senders matching 6282211700060 or 8G710FV6:", JSON.stringify(matchingSenders, null, 2));
      } else {
        console.log("Response JSON:", JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      console.log("Exp 2 Error:", e.message);
    }

    console.log("\n--- EXPERIMENT 3: CONNECTOR STATUS ---");
    try {
      const res = await fetch(`${creds.baseUrl}/connector/status?phone=6282211700060`, {
        method: 'GET',
        headers
      });
      const data = await res.json().catch(() => ({}));
      console.log("HTTP Status:", res.status);
      console.log("Response JSON:", JSON.stringify(data, null, 2));
    } catch (e: any) {
      console.log("Exp 3 Error:", e.message);
    }

  } catch (err: any) {
    console.error("Global script error:", err.message);
  }
}

main().catch(console.error);
