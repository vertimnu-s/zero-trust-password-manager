output "sns_topic_arn" {
  description = "SNS topic ARN for security alerts — attach to CloudWatch alarms"
  value       = var.enabled ? aws_sns_topic.security_alerts[0].arn : null
}

output "guardduty_detector_id" {
  value = var.enabled ? aws_guardduty_detector.main[0].id : null
}

output "enabled" {
  value = var.enabled
}
