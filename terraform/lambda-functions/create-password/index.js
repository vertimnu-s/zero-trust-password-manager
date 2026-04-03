import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.PASSWORD_TABLE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,POST",
};

function buildResponse(statusCode, body) {
  return {
    statusCode,
    headers: corsHeaders,
    body: body == null ? "" : JSON.stringify(body),
  };
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

    const body = JSON.parse(event.body);

    if (!body.site || !body.username) {
      return buildResponse(400, { message: "site and username are required" });
    }

    const itemKey = `${body.site}#${body.username}`;

    const item = {
      userId: { S: userId },
      itemKey: { S: itemKey },
      site: { S: body.site },
      username: { S: body.username },
      cipherText: { S: body.cipherText },
      iv: { S: body.iv },
      salt: { S: body.salt },
      category: { S: body.category || "login" },
      folder: { S: body.folder || "" },
      favorite: { BOOL: !!body.favorite },
      requireMasterPassword: { BOOL: body.requireMasterPassword ?? true },
      createdAt: { N: Date.now().toString() },
    };

    await client.send(
      new PutItemCommand({
        TableName: TABLE_NAME,
        Item: item,
      })
    );

    return buildResponse(200, { message: "Saved successfully" });
  } catch (error) {
    console.error("Error creating password:", error);
    return buildResponse(500, { error: error.message });
  }
};
