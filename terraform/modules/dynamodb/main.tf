# DynamoDB Module - PasswordVault Table

resource "aws_dynamodb_table" "password_vault" {
  name           = "${var.project_name}-${var.environment}"
  billing_mode   = var.billing_mode
  hash_key       = "userId"          # Partition key
  range_key      = "itemKey"         # Sort key

  # PARTITION KEY - Amazon Cognito sub claim (unique user ID)
  attribute {
    name = "userId"
    type = "S"  # String
  }

  # SORT KEY - Composite of site#username (e.g., "github.com#john@example.com")
  # This allows fast queries per user and prevents duplicate entries
  attribute {
    name = "itemKey"
    type = "S"  # String
  }

  # ENCRYPTION AT REST - AWS managed keys by default
  # Data is encrypted when written to disk
  server_side_encryption {
    enabled     = var.enable_encryption
    kms_key_arn = null  # Uses AWS managed key (sufficient for dissertation)
    # To use customer-managed KMS key: kms_key_arn = aws_kms_key.dynamodb.arn
  }

  # POINT-IN-TIME RECOVERY - Critical for a password manager!
  # Allows restore to any point in time for last 35 days
  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }

  # STREAMS - Capture item-level modifications (optional enhancement)
  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  # TAGS
  tags = {
    Name              = "${var.project_name}-password-vault"
    DataClassification = "Sensitive"
    BackupRequired     = "true"
  }

  # LIFECYCLE - Prevent accidental deletion during development
  lifecycle {
    prevent_destroy = true  # You must explicitly remove this to delete the table
  }
}

# Optional: Enable TTL for auto-deletion of old password records (if needed)
# Uncomment if you want to automatically delete records after a certain age
# resource "aws_dynamodb_ttl" "password_vault_ttl" {
#   name           = "expirationTime"
#   attribute_name = "ttl"
#   enabled        = true
#   table_name     = aws_dynamodb_table.password_vault.name
# }

# Optional: CloudWatch alarms for monitoring
resource "aws_cloudwatch_metric_alarm" "dynamodb_read_throttle" {
  alarm_name          = "${var.project_name}-dynamodb-read-throttle"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "ReadThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alert when DynamoDB read throttling occurs"
  alarm_actions       = []  # You can add SNS topic here later

  dimensions = {
    TableName = aws_dynamodb_table.password_vault.name
  }
}

resource "aws_cloudwatch_metric_alarm" "dynamodb_write_throttle" {
  alarm_name          = "${var.project_name}-dynamodb-write-throttle"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "WriteThrottleEvents"
  namespace           = "AWS/DynamoDB"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alert when DynamoDB write throttling occurs"
  alarm_actions       = []  # You can add SNS topic here later

  dimensions = {
    TableName = aws_dynamodb_table.password_vault.name
  }
}
