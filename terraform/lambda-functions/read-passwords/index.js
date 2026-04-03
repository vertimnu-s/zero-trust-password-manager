
import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const client = new DynamoDBClient({});
const s3 = new S3Client({});
const TABLE_NAME = process.env.PASSWORD_TABLE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
const AUDIT_BUCKET = process.env.AUDIT_LOG_BUCKET;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,GET",
};

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify(body),
  };
}

async function writeAuditLog(userId, action, success, details) {
  try {
    const timestamp = new Date().toISOString();
    const key = `audit-logs/${action}/${timestamp}-${crypto.randomUUID()}.json`;
    await s3.send(new PutObjectCommand({
      Bucket: AUDIT_BUCKET,
      Key: key,
      Body: JSON.stringify({ userId, action, success, details, timestamp }),
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

    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: {
          ":uid": { S: userId },
        },
      })
    );

    await writeAuditLog(userId, "read_passwords", true, `Retrieved ${(result.Items || []).length} items`);
    return buildResponse(200, result.Items || []);
  } catch (error) {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    await writeAuditLog(userId || "unknown", "read_passwords", false, "Internal error");
    console.error("Error in read-passwords:", error);
    return buildResponse(500, { message: "Internal server error" });
  }
};
