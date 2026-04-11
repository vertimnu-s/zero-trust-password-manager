# Automated Incident Response — auto-blocks attacker IPs via WAF
# and disables compromised Cognito users based on GuardDuty findings.
#
# Cost impact: $0 additional
# - Lambda: free tier (1M invocations/month)
# - WAF IP set: included with existing WAF
# - EventBridge: free
# - SQS DLQ: free tier
# - SNS: already exists, no new topics

terraform {
  required_providers {
    aws = {
      source                = "hashicorp/aws"
      configuration_aliases = [aws, aws.us_east_1]
    }
  }
}

# ========== WAF IP Set (us-east-1 for CLOUDFRONT scope) ==========
resource "aws_wafv2_ip_set" "blocked_ips" {
  provider = aws.us_east_1
  count    = var.enabled ? 1 : 0

  name               = "${var.project_name}-blocked-ips-${var.environment}"
  description        = "IPs blocked by automated incident response"
  scope              = "CLOUDFRONT"
  ip_address_version = "IPV4"
  addresses          = []

  tags = {
    Name = "${var.project_name}-blocked-ips-${var.environment}"
  }
}

# ========== DLQ for failed remediation invocations ==========
resource "aws_sqs_queue" "remediation_dlq" {
  count = var.enabled ? 1 : 0

  name                      = "${var.project_name}-remediation-dlq-${var.environment}"
  message_retention_seconds = 1209600

  tags = { Name = "${var.project_name}-remediation-dlq" }
}

# ========== IAM Role ==========
resource "aws_iam_role" "remediation_role" {
  count = var.enabled ? 1 : 0

  name = "${var.project_name}-remediation-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_role_policy" "remediation_policy" {
  count = var.enabled ? 1 : 0

  name = "${var.project_name}-remediation-policy"
  role = aws_iam_role.remediation_role[0].id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "CloudWatchLogs"
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:log-group:/aws/lambda/*"
      },
      {
        Sid    = "WAFIPSet"
        Effect = "Allow"
        Action = [
          "wafv2:GetIPSet",
          "wafv2:UpdateIPSet"
        ]
        Resource = aws_wafv2_ip_set.blocked_ips[0].arn
      },
      {
        Sid    = "CognitoDisableUser"
        Effect = "Allow"
        Action = [
          "cognito-idp:AdminDisableUser",
          "cognito-idp:ListUsers"
        ]
        Resource = var.cognito_user_pool_arn
      },
      {
        Sid      = "SNSPublish"
        Effect   = "Allow"
        Action   = ["sns:Publish"]
        Resource = var.sns_topic_arn != null ? var.sns_topic_arn : "*"
      },
      {
        Sid    = "DLQSend"
        Effect = "Allow"
        Action = ["sqs:SendMessage"]
        Resource = aws_sqs_queue.remediation_dlq[0].arn
      }
    ]
  })
}

# ========== CloudWatch Log Group ==========
resource "aws_cloudwatch_log_group" "remediation" {
  count = var.enabled ? 1 : 0

  name              = "/aws/lambda/${var.project_name}-incident-response-${var.environment}"
  retention_in_days = var.log_retention_days
}

# ========== Lambda Function ==========
data "archive_file" "remediation_zip" {
  count = var.enabled ? 1 : 0

  type        = "zip"
  source_dir  = "${path.module}/../../lambda-functions/incident-response"
  output_path = "${path.module}/../../lambda-functions/incident-response.zip"
}

resource "aws_lambda_function" "remediation" {
  count = var.enabled ? 1 : 0

  function_name    = "${var.project_name}-incident-response-${var.environment}"
  role             = aws_iam_role.remediation_role[0].arn
  handler          = "index.handler"
  runtime          = "nodejs20.x"
  timeout          = 30
  memory_size      = 256
  filename         = data.archive_file.remediation_zip[0].output_path
  source_code_hash = data.archive_file.remediation_zip[0].output_base64sha256

  dead_letter_config {
    target_arn = aws_sqs_queue.remediation_dlq[0].arn
  }

  environment {
    variables = {
      WAF_IP_SET_ID        = aws_wafv2_ip_set.blocked_ips[0].id
      WAF_IP_SET_NAME      = aws_wafv2_ip_set.blocked_ips[0].name
      COGNITO_USER_POOL_ID = var.cognito_user_pool_id
      SNS_TOPIC_ARN        = var.sns_topic_arn != null ? var.sns_topic_arn : ""
    }
  }

  depends_on = [
    aws_cloudwatch_log_group.remediation[0],
    aws_iam_role_policy.remediation_policy[0]
  ]
}

# ========== EventBridge Rule — GuardDuty findings MEDIUM+ ==========
resource "aws_cloudwatch_event_rule" "guardduty_remediation" {
  count = var.enabled ? 1 : 0

  name        = "${var.project_name}-guardduty-remediation-${var.environment}"
  description = "Route GuardDuty findings to incident response Lambda"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", 4.0] }]
    }
  })
}

resource "aws_cloudwatch_event_target" "guardduty_to_lambda" {
  count = var.enabled ? 1 : 0

  rule      = aws_cloudwatch_event_rule.guardduty_remediation[0].name
  target_id = "incident-response-lambda"
  arn       = aws_lambda_function.remediation[0].arn
}

resource "aws_lambda_permission" "eventbridge_invoke" {
  count = var.enabled ? 1 : 0

  statement_id  = "AllowEventBridgeInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.remediation[0].function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.guardduty_remediation[0].arn
}
