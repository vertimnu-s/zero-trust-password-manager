variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "log_retention_days" {
  description = "CloudWatch Logs retention period in days (free tier optimized)"
  type        = number
  default     = 7  # Reduced from 30 for free tier (free tier: 10GB ingestion/month)
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for alarm notifications (null if disabled)"
  type        = string
  default     = null
}
