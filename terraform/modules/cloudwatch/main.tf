# CloudWatch Module - CloudWatch Log Groups for Lambda functions

# Log group for CREATE PASSWORD Lambda
# Note: Free tier includes 10GB ingestion/month. At 7-day retention, this is very comfortable.
resource "aws_cloudwatch_log_group" "create_password" {
  name              = "/aws/lambda/${var.project_name}-create-password-${var.environment}"
  retention_in_days = var.log_retention_days  # Default: 7 days (free tier optimized)

  tags = {
    Name     = "${var.project_name}-create-password-logs"
    Function = "CreatePassword"
  }
}

# Log group for READ PASSWORDS Lambda
resource "aws_cloudwatch_log_group" "read_passwords" {
  name              = "/aws/lambda/${var.project_name}-read-passwords-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name     = "${var.project_name}-read-passwords-logs"
    Function = "ReadPasswords"
  }
}

# Log group for UPDATE PASSWORD Lambda
resource "aws_cloudwatch_log_group" "update_password" {
  name              = "/aws/lambda/${var.project_name}-update-password-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name     = "${var.project_name}-update-password-logs"
    Function = "UpdatePassword"
  }
}

# Log group for DELETE PASSWORD Lambda
resource "aws_cloudwatch_log_group" "delete_password" {
  name              = "/aws/lambda/${var.project_name}-delete-password-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name     = "${var.project_name}-delete-password-logs"
    Function = "DeletePassword"
  }
}

# Optional: API Gateway access logs
resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name    = "${var.project_name}-api-gateway-logs"
    Service = "APIGateway"
  }
}

# Optional: CloudWatch Alarms for Lambda errors
resource "aws_cloudwatch_metric_alarm" "create_password_errors" {
  alarm_name          = "${var.project_name}-create-password-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alert when CREATE password Lambda has errors"
  alarm_actions       = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  dimensions = {
    FunctionName = "${var.project_name}-create-password-${var.environment}"
  }
}

resource "aws_cloudwatch_metric_alarm" "read_passwords_errors" {
  alarm_name          = "${var.project_name}-read-passwords-errors"
  comparison_operator = "GreaterThanOrEqualToThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 1
  alarm_description   = "Alert when READ passwords Lambda has errors"
  alarm_actions       = var.sns_topic_arn != null ? [var.sns_topic_arn] : []

  dimensions = {
    FunctionName = "${var.project_name}-read-passwords-${var.environment}"
  }
}

# CloudWatch Alarms are FREE (no charge for alarms themselves)
# But you only pay if you add SNS notifications ($0.50 per million notifications)
# For free tier, these alarms are safe to keep - they detect errors for free!

# Optional: Lambda Insights extension for advanced monitoring
# Uncomment to enable detailed Lambda insights (requires payments)
# resource "aws_cloudwatch_log_group" "lambda_insights" {
#   name              = "/aws/lambda-insights:${var.project_name}-${var.environment}"
#   retention_in_days = var.log_retention_days
# }

# Optional: CloudWatch Alarms for Lambda errors
# These are FREE but add SNS notifications if you enable them
