# GuardDuty — continuously monitors for threats across the AWS account.
# Analyzes CloudTrail events, VPC flow logs, and DNS queries to detect
# compromised credentials, unusual API activity, and reconnaissance.

resource "aws_guardduty_detector" "main" {
  count = var.enabled ? 1 : 0

  enable                       = true
  finding_publishing_frequency = "FIFTEEN_MINUTES"

  tags = {
    Name = "${var.project_name}-guardduty-${var.environment}"
  }
}

# SNS topic — central notification channel for all security alerts.
# GuardDuty findings, CloudWatch alarms, and WAF alerts all route here.
resource "aws_sns_topic" "security_alerts" {
  count = var.enabled ? 1 : 0

  name = "${var.project_name}-security-alerts-${var.environment}"

  tags = {
    Name = "${var.project_name}-security-alerts-${var.environment}"
  }
}

resource "aws_sns_topic_subscription" "email" {
  count = var.enabled ? 1 : 0

  topic_arn = aws_sns_topic.security_alerts[0].arn
  protocol  = "email"
  endpoint  = var.alert_email
}

# SNS topic policy — allows EventBridge and CloudWatch to publish to the topic
resource "aws_sns_topic_policy" "security_alerts" {
  count = var.enabled ? 1 : 0

  arn = aws_sns_topic.security_alerts[0].arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowEventBridgePublish"
        Effect    = "Allow"
        Principal = { Service = "events.amazonaws.com" }
        Action    = "SNS:Publish"
        Resource  = aws_sns_topic.security_alerts[0].arn
      },
      {
        Sid       = "AllowCloudWatchPublish"
        Effect    = "Allow"
        Principal = { Service = "cloudwatch.amazonaws.com" }
        Action    = "SNS:Publish"
        Resource  = aws_sns_topic.security_alerts[0].arn
      }
    ]
  })
}

# EventBridge rule — routes GuardDuty findings (medium+ severity) to SNS.
# Severity >= 4.0 covers MEDIUM and HIGH findings, filtering out LOW noise.
resource "aws_cloudwatch_event_rule" "guardduty_findings" {
  count = var.enabled ? 1 : 0

  name        = "${var.project_name}-guardduty-findings-${var.environment}"
  description = "Route GuardDuty findings to SNS"

  event_pattern = jsonencode({
    source      = ["aws.guardduty"]
    detail-type = ["GuardDuty Finding"]
    detail = {
      severity = [{ numeric = [">=", 4.0] }]
    }
  })

  tags = {
    Name = "${var.project_name}-guardduty-rule-${var.environment}"
  }
}

resource "aws_cloudwatch_event_target" "guardduty_to_sns" {
  count = var.enabled ? 1 : 0

  rule      = aws_cloudwatch_event_rule.guardduty_findings[0].name
  target_id = "send-to-sns"
  arn       = aws_sns_topic.security_alerts[0].arn

  input_transformer {
    input_paths = {
      severity    = "$.detail.severity"
      title       = "$.detail.title"
      description = "$.detail.description"
      account     = "$.detail.accountId"
      region      = "$.detail.region"
      type        = "$.detail.type"
      time        = "$.time"
    }

    input_template = "\"[GuardDuty] Severity <severity>: <title>\\n\\nType: <type>\\nDescription: <description>\\nAccount: <account>\\nRegion: <region>\\nTime: <time>\""
  }
}
