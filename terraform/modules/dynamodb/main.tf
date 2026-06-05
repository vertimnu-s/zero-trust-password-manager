resource "aws_dynamodb_table" "password_vault" {
  name           = "${var.project_name}-${var.environment}"
  billing_mode   = var.billing_mode
  hash_key       = "userId"          # Partition key
  range_key      = "itemKey"         # Sort key

  attribute {
    name = "userId"
    type = "S"  # String
  }

  attribute {
    name = "itemKey"
    type = "S"  # String
  }

  server_side_encryption {
    enabled     = var.enable_encryption
    kms_key_arn = var.kms_key_arn
  }

  point_in_time_recovery {
    enabled = var.point_in_time_recovery
  }

  stream_enabled   = true
  stream_view_type = "NEW_AND_OLD_IMAGES"

  tags = {
    Name              = "${var.project_name}-password-vault"
    DataClassification = "Sensitive"
    BackupRequired     = "true"
  }

  lifecycle {
    prevent_destroy = true  # You must explicitly remove this to delete the table
  }
}


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
