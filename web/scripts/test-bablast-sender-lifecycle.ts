import { getBablastCredentials } from '../src/services/communication/communication.config';

async function main() {
  console.log("=== BABLAST SENDER LIFECYCLE DIAGNOSTIC SCRIPT ===");
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

    let senderCode = "";

    console.log("\n--- TEST 1: CREATE SENDER ---");
    try {
      const payload = {
        channel_type: "unofficial",
        unofficial_notice: "",
        nama: "UQI API TEST",
        phone: "+6281575652263",
        access_token: "",
        facebook_page_id: "",
        ig_business_account_id: "",
        ig_name: "",
        ig_username: ""
      };
      
      const res = await fetch(`${creds.baseUrl}/api/sender_whatsapp`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      console.log("HTTP Status:", res.status);
      console.log("Success:", data.success);
      if (data.data) {
        console.log("data.id:", data.data.id);
        console.log("data.kode:", data.data.kode);
        console.log("data.channel_type:", data.data.channel_type);
        console.log("data.status:", data.data.status);
        console.log("data.phone:", data.data.phone);
        senderCode = data.data.kode || "";
      } else {
        console.log("Response JSON:", JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      console.log("Test 1 Error:", e.message);
    }

    console.log("\n--- TEST 2: VERIFY SENDER DISCOVERY ---");
    try {
      const res = await fetch(`${creds.baseUrl}/senders`, {
        method: 'GET',
        headers
      });
      const data = await res.json().catch(() => ({}));
      console.log("HTTP Status:", res.status);
      const senders = data.data || data;
      if (Array.isArray(senders)) {
        const target = senders.find((s: any) => s.phone === '6281575652263' || s.phone === '+6281575652263');
        if (target) {
          console.log("Found sender:", JSON.stringify({
            id: target.id,
            name: target.name || target.nama,
            phone: target.phone,
            status: target.status,
            channelType: target.channelType || target.channel_type,
            kode: target.kode || target.sender_code || "NOT RETURNED"
          }, null, 2));
        } else {
          console.log("Sender +6281575652263 NOT FOUND in /senders.");
        }
      } else {
        console.log("Response JSON:", JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      console.log("Test 2 Error:", e.message);
    }

    console.log("\n--- TEST 3: VERIFY CONNECTOR STATUS ---");
    let isConnected = false;
    try {
      const res = await fetch(`${creds.baseUrl}/connector/status?phone=6281575652263`, {
        method: 'GET',
        headers
      });
      const data = await res.json().catch(() => ({}));
      console.log("HTTP Status:", res.status);
      if (data.data) {
        console.log("isConnected:", data.data.isConnected);
        console.log("status:", data.data.status);
        console.log("sessionData:", JSON.stringify(data.data.sessionData, null, 2));
        isConnected = !!data.data.isConnected;
      } else {
        console.log("Response JSON:", JSON.stringify(data, null, 2));
      }
    } catch (e: any) {
      console.log("Test 3 Error:", e.message);
    }

    if (!isConnected) {
      console.log("\nSTOP: Connector is NOT connected for 6281575652263. Cannot proceed to Test 4 (Direct Send).");
      return;
    }

    // Force senderCode if Test 1 failed but we know the user provided the code EFYK91RO
    if (!senderCode) {
      console.log("\nsenderCode was not obtained from Test 1 (likely 401 Unauthorized). Using known code EFYK91RO provided by user.");
      senderCode = "EFYK91RO";
    }

    console.log("\n--- TEST 4: DIRECT SEND API ---");
    try {
      const payload = {
        phone: '6282211700060', // Safe test recipient
        message: 'Test direct API dari sender Bablast yang baru dibuat.',
        sender_code: senderCode
      };
      
      const res = await fetch(`${creds.baseUrl}/send`, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload)
      });
      const data = await res.json().catch(() => ({}));
      console.log("HTTP Status:", res.status);
      console.log("Success:", data.success);
      console.log("Message:", data.message);
      console.log("Response Data:", JSON.stringify(data.data || data, null, 2));
    } catch (e: any) {
      console.log("Test 4 Error:", e.message);
    }

  } catch (err: any) {
    console.error("Global script error:", err.message);
  }
}

main().catch(console.error);
