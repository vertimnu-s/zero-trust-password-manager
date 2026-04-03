import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new DynamoDBClient({});
const s3 = new S3Client({});
const TABLE_NAME = process.env.PASSWORD_TABLE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const AUDIT_BUCKET = process.env.AUDIT_LOG_BUCKET;

const MAX_SHORT_FIELD = 256;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,DELETE",
};

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

async function writeAuditLog(userId, action, site, success, details) {
  try {
    const timestamp = new Date().toISOString();
    const key = `audit-logs/${action}/${timestamp}-${crypto.randomUUID()}.json`;
    await s3.send(new PutObjectCommand({
      Bucket: AUDIT_BUCKET,
      Key: key,
      Body: JSON.stringify({ userId, action, site, success, details, timestamp }),
      ContentType: "application/json",
    }));
  } catch (err) {
    console.error("Audit log write failed:", err);
  }
}

export const handler = async (event) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) {
      return buildResponse(401, { message: "Unauthorized" });
    }

    const { site, username } = event.queryStringParameters || {};

    if (
      !site || !username ||
      typeof site !== "string" || typeof username !== "string" ||
      site.length > MAX_SHORT_FIELD || username.length > MAX_SHORT_FIELD
    ) {
      return buildResponse(400, {
        message: "site and username query parameters are required",
      });
    }

    const itemKey = `${site}#${username}`;

    await client.send(
      new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: {
          userId: { S: userId },
          itemKey: { S: itemKey },
        },
      })
    );

    await writeAuditLog(userId, "delete_password", site, true, "Item deleted");
    return buildResponse(200, { message: "Deleted successfully" });
  } catch (error) {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    await writeAuditLog(userId || "unknown", "delete_password", null, false, "Internal error");
    console.error("Error deleting password:", error);
    return buildResponse(500, { message: "Internal server error" });
  }
};
