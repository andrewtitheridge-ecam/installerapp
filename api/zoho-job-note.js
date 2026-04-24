const ZOHO_ACCOUNTS_URL = "https://accounts.zoho.com";
const ZOHO_API_DOMAIN = process.env.ZOHO_API_DOMAIN || "https://www.zohoapis.com";

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function getAccessToken() {
  const params = new URLSearchParams({
    refresh_token: process.env.ZOHO_REFRESH_TOKEN || "",
    client_id: process.env.ZOHO_CLIENT_ID || "",
    client_secret: process.env.ZOHO_CLIENT_SECRET || "",
    grant_type: "refresh_token"
  });

  const response = await fetch(`${ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zoho token refresh failed: ${text}`);
  }

  return response.json();
}

async function createJobNote(accessToken, jobRecordId, noteContent) {
  if (!noteContent) {
    return 0;
  }

  const response = await fetch(`${ZOHO_API_DOMAIN}/crm/v8/Install/${jobRecordId}/Notes`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      data: [
        {
          Note_Title: "Installer App Note",
          Note_Content: noteContent
        }
      ]
    })
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zoho note create failed: ${text}`);
  }

  return 1;
}

async function fetchJobStatus(accessToken, jobRecordId) {
  const response = await fetch(`${ZOHO_API_DOMAIN}/crm/v8/Install/${jobRecordId}?fields=${encodeURIComponent("Status")}`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zoho job status lookup failed: ${text}`);
  }

  const json = await response.json();
  const job = json.data && json.data.length ? json.data[0] : null;
  return job?.Status || "";
}

async function uploadAttachment(accessToken, jobRecordId, file) {
  const bytes = Buffer.from(file.contentBase64, "base64");
  const form = new FormData();
  const blob = new Blob([bytes], { type: file.type || "image/jpeg" });
  form.append("file", blob, file.name || "upload.jpg");

  const response = await fetch(`${ZOHO_API_DOMAIN}/crm/v8/Install/${jobRecordId}/Attachments`, {
    method: "POST",
    headers: {
      Authorization: `Zoho-oauthtoken ${accessToken}`
    },
    body: form
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zoho attachment upload failed: ${text}`);
  }

  return 1;
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const missing = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN"].filter((key) => !process.env[key]);
  if (missing.length) {
    return sendJson(res, 500, { error: `Missing Zoho environment variables: ${missing.join(", ")}` });
  }

  try {
    const { jobRecordId, note, files } = req.body || {};

    if (!jobRecordId) {
      return sendJson(res, 400, { error: "Job record ID is required." });
    }

    const normalizedNote = typeof note === "string" ? note.trim() : "";
    const normalizedFiles = Array.isArray(files) ? files : [];

    if (!normalizedNote && normalizedFiles.length === 0) {
      return sendJson(res, 400, { error: "Provide note text or at least one image." });
    }

    const tokenData = await getAccessToken();
    const accessToken = tokenData.access_token;
    const jobStatus = await fetchJobStatus(accessToken, jobRecordId);

    if (String(jobStatus).trim().toLowerCase() !== "scheduled") {
      return sendJson(res, 403, { error: "Notes and photos can only be added while the job is in Scheduled status." });
    }

    let createdNotes = 0;
    let uploadedFiles = 0;

    if (normalizedNote) {
      createdNotes += await createJobNote(accessToken, jobRecordId, normalizedNote);
    }

    for (const file of normalizedFiles) {
      if (!file?.contentBase64) {
        continue;
      }
      uploadedFiles += await uploadAttachment(accessToken, jobRecordId, file);
    }

    return sendJson(res, 200, {
      ok: true,
      createdNotes,
      uploadedFiles
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Zoho job note save failed." });
  }
};
