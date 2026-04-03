// Lambda function to read/fetch password items from the vault
// Environment variables: PASSWORD_TABLE, ALLOWED_ORIGIN

import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.PASSWORD_TABLE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

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

export const handler = async (event) => {
  try {
    // Debug logging
    console.log("🔍 Event received:", JSON.stringify(event, null, 2));
    console.log("🔐 Authorizer context:", JSON.stringify(event.requestContext?.authorizer, null, 2));
    
    // Extract user ID from Cognito token (added by authorizer)
    const userId = event.requestContext?.authorizer?.jwt?.claims?.sub;
    console.log("👤 Extracted userId:", userId);
    
    if (!userId) {
      console.error("❌ No user ID found in authorizer claims");
      return buildResponse(401, { message: "Unauthorized - no user ID" });
    }

    // Query all password items for this user
    const result = await client.send(
      new QueryCommand({
        TableName: TABLE_NAME,
        KeyConditionExpression: "userId = :uid",
        ExpressionAttributeValues: {
          ":uid": { S: userId },
        },
      })
    );

    console.log(`✅ Query successful`);
    console.log(
      `Retrieved ${result.Items?.length || 0} password items for user ${userId}`
    );
    console.log(`📊 Table name used: ${TABLE_NAME}`);

    return buildResponse(200, result.Items || []);
  } catch (error) {
    console.error("❌ Error in read-passwords handler:", error);
    console.error("📊 Table name attempted:", TABLE_NAME);
    return buildResponse(500, { error: error.message });
  }
};
