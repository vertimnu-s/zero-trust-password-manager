// Lambda function to update a password item in the vault
// FIXED BUG: Original had duplicate userId in Key, now handles item key changes properly
// Environment variables: PASSWORD_TABLE, ALLOWED_ORIGIN

import {
  DynamoDBClient,
  UpdateItemCommand,
  DeleteItemCommand,
  PutItemCommand,
} from "@aws-sdk/client-dynamodb";

const client = new DynamoDBClient({});
const TABLE_NAME = process.env.PASSWORD_TABLE;
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;

const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "Content-Type,Authorization",
  "Access-Control-Allow-Methods": "OPTIONS,PUT",
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

    // Parse request body
    if (!event.body) {
      return buildResponse(400, { message: "Request body is required" });
    }

    const body = JSON.parse(event.body);

    // Validate required fields
    if (!body.site || !body.username) {
      return buildResponse(400, { message: "site and username are required" });
    }

    // Extract old and new item keys
    const oldItemKey = body.oldItemKey;
    const newItemKey = `${body.site}#${body.username}`;

    // If the item key changed (site or username changed), delete old and create new
    if (oldItemKey && oldItemKey !== newItemKey) {
      // Delete the old item
      await client.send(
        new DeleteItemCommand({
          TableName: TABLE_NAME,
          Key: {
            userId: { S: userId },
            itemKey: { S: oldItemKey },
          },
        })
      );

      // Create new item with updated data
      const newItem = {
        userId: { S: userId },
        itemKey: { S: newItemKey },
        site: { S: body.site },
        username: { S: body.username },
        cipherText: { S: body.cipherText },
        iv: { S: body.iv },
        salt: { S: body.salt },
        category: { S: body.category || "login" },
        folder: { S: body.folder || "" },
        favorite: { BOOL: !!body.favorite },
        requireMasterPassword: { BOOL: body.requireMasterPassword ?? true },
        updatedAt: { N: Date.now().toString() },
      };

      await client.send(
        new PutItemCommand({
          TableName: TABLE_NAME,
          Item: newItem,
        })
      );

      console.log(
        `Password item migrated for user ${userId}: ${oldItemKey} → ${newItemKey}`
      );
    } else {
      // Item key hasn't changed, just update the existing item
      await client.send(
        new UpdateItemCommand({
          TableName: TABLE_NAME,
          Key: {
            userId: { S: userId },
            itemKey: { S: newItemKey },
          },
          UpdateExpression:
            "SET #ct = :ct, #iv = :iv, #salt = :salt, #cat = :cat, #folder = :folder, #fav = :fav, #rmp = :rmp, #updated = :updated",
          ExpressionAttributeNames: {
            "#ct": "cipherText",
            "#iv": "iv",
            "#salt": "salt",
            "#cat": "category",
            "#folder": "folder",
            "#fav": "favorite",
            "#rmp": "requireMasterPassword",
            "#updated": "updatedAt",
          },
          ExpressionAttributeValues: {
            ":ct": { S: body.cipherText },
            ":iv": { S: body.iv },
            ":salt": { S: body.salt },
            ":cat": { S: body.category || "login" },
            ":folder": { S: body.folder || "" },
            ":fav": { BOOL: !!body.favorite },
            ":rmp": { BOOL: body.requireMasterPassword ?? true },
            ":updated": { N: Date.now().toString() },
          },
        })
      );

      console.log(`Password item updated for user ${userId}: ${newItemKey}`);
    }

    return buildResponse(200, { message: "Updated successfully" });
  } catch (error) {
    console.error("Error in update-password handler:", error);
    return buildResponse(500, { error: error.message });
  }
};
