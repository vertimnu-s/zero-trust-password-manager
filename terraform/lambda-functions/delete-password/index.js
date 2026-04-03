import { DynamoDBClient, DeleteItemCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.PASSWORD_TABLE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

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

export const handler = async (event) => {
  try {
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) {
      return buildResponse(401, { message: "Unauthorized" });
    }

    const { site, username } = event.queryStringParameters || {};

    if (!site || !username) {
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

    return buildResponse(200, { message: "Deleted successfully" });
  } catch (error) {
    console.error("Error deleting password:", error);
    return buildResponse(500, { error: error.message });
  }
};
