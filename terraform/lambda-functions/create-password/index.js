import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new DynamoDBClient({});
const s3 = new S3Client({});
const TABLE_NAME = process.env.PASSWORD_TABLE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const AUDIT_BUCKET = process.env.AUDIT_LOG_BUCKET;

const MAX_FIELD_LENGTH = 10000;
const MAX_SHORT_FIELD = 256;
const BASE64_REGEX = /^[A-Za-z0-9+/=]+$/;
const VALID_CATEGORIES = ["login", "card", "identity", "secure note"];

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Cache-Control": "no-store",
  "Content-Type": "application/json",
};

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  };
}

function isNonEmptyString(val, maxLen = MAX_SHORT_FIELD) {
  return typeof val === "string" && val.length > 0 && val.length <= maxLen;
}

function isBase64(val, maxLen = MAX_FIELD_LENGTH) {
  return typeof val === "string" && val.length > 0 && val.length <= maxLen && BASE64_REGEX.test(val);
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

    if (!event.body) {
      return buildResponse(400, { message: "Request body is required" });
    }

    let body;
    try {
      body = JSON.parse(event.body);
    } catch {
      return buildResponse(400, { message: "Invalid JSON" });
    }

    if (!isNonEmptyString(body.site) || !isNonEmptyString(body.username)) {
      return buildResponse(400, { message: "site and username are required" });
    }

    if (!isBase64(body.cipherText) || !isBase64(body.iv) || !isBase64(body.salt)) {
      return buildResponse(400, { message: "Invalid encrypted payload" });
    }

    const category = VALID_CATEGORIES.includes(body.category) ? body.category : "login";
    const folder = isNonEmptyString(body.folder, MAX_SHORT_FIELD) ? body.folder : "";
    const itemKey = `${body.site}#${body.username}`;

    const item = {
      userId: { S: userId },
      itemKey: { S: itemKey },
      site: { S: body.site },
      username: { S: body.username },
      cipherText: { S: body.cipherText },
      iv: { S: body.iv },
      salt: { S: body.salt },
      category: { S: category },
      folder: { S: folder },
      favorite: { BOOL: !!body.favorite },
      requireMasterPassword: { BOOL: body.requireMasterPassword ?? true },
      createdAt: { N: Date.now().toString() },
    };

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: item,
        ConditionExpression: "attribute_not_exists(itemKey)",
      })
    );

    await writeAuditLog(userId, "create_password", body.site, true, "Item created");
    return buildResponse(200, { message: "Saved successfully" });
  } catch (error) {
    if (error.name === "ConditionalCheckFailedException") {
      return buildResponse(409, { message: "An item with this site and username already exists" });
    }
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    await writeAuditLog(userId || "unknown", "create_password", null, false, "Internal error");
    console.error("Error creating password:", error);
    return buildResponse(500, { message: "Internal server error" });
  }
};
