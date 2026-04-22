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

async function fetchJob(accessToken, jobId) {
  const criteria = `(Job_ID_Number:equals:${jobId})`;
  const response = await fetch(`${ZOHO_API_DOMAIN}/crm/v8/Install/search?criteria=${encodeURIComponent(criteria)}`, {
    headers: { Authorization: `Zoho-oauthtoken ${accessToken}` }
  });

  if (response.status === 204) {
    return null;
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Zoho job lookup failed: ${text}`);
  }

  const json = await response.json();
  return json.data && json.data.length ? json.data[0] : null;
}

module.exports = async (req, res) => {
  if (req.method !== "GET") {
    return sendJson(res, 405, { error: "Method not allowed." });
  }

  const missing = ["ZOHO_CLIENT_ID", "ZOHO_CLIENT_SECRET", "ZOHO_REFRESH_TOKEN"].filter((key) => !process.env[key]);
  if (missing.length) {
    return sendJson(res, 500, { error: `Missing Zoho environment variables: ${missing.join(", ")}` });
  }

  const jobId = (req.query.jobId || "").trim();
  if (!jobId) {
    return sendJson(res, 400, { error: "Job number is required." });
  }

  try {
    const tokenData = await getAccessToken();
    const job = await fetchJob(tokenData.access_token, jobId);

    if (!job) {
      return sendJson(res, 404, { error: `No job found for ${jobId}.` });
    }

    const cameras = Array.isArray(job.Kit_Information)
      ? job.Kit_Information
          .filter((item) => item.Evercam_ID)
          .map((item) => ({
            id: item.Evercam_ID,
            name: item.Camera_Name || "",
            type: item.Type || "",
            power: item.Power1 || ""
          }))
      : [];

    return sendJson(res, 200, {
      id: job.id,
      jobNumber: job.Job_ID_Number,
      name: job.Name,
      status: job.Status || "",
      installDate: job.Install_Date || job.Requested_Install_Date || "",
      dealName: job.Deal_Name?.name || "",
      projectName: job.Projex?.name || "",
      cameras
    });
  } catch (error) {
    return sendJson(res, 500, { error: error.message || "Zoho job lookup failed." });
  }
};
