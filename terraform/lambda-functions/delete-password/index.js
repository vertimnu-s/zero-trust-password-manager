// Lambda function to delete a password item from the vault
// Environment variables: PASSWORD_TABLE, ALLOWED_ORIGIN

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
    // Handle OPTIONS requests (CORS preflight)
    if (event.requestContext?.http?.method === "OPTIONS") {
      return buildResponse(200, null);
    }

    // Extract user ID from Cognito token (added by authorizer)
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    if (!userId) {
      return buildResponse(401, { message: "Unauthorized - no user ID" });
    }

    // Get query parameters: site and username
    const { site, username } = event.queryStringParameters || {};

    if (!site || !username) {
      return buildResponse(400, {
        message: "site and username query parameters are required",
      });
    }

    // Create composite item key
    const itemKey = `${site}#${username}`;

    // Delete from DynamoDB
    await client.send(
      new DeleteItemCommand({
        TableName: TABLE_NAME,
        Key: {
          userId: { S: userId },
          itemKey: { S: itemKey },
        },
      })
    );

    console.log(`Password item deleted for user ${userId}: ${itemKey}`);

    return buildResponse(200, { message: "Deleted successfully" });
  } catch (error) {
    console.error("Error in delete-password handler:", error);
    return buildResponse(500, { error: error.message });
  }
};
