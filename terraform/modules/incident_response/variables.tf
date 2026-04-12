variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "enabled" {
  description = "Toggle incident response on/off (requires GuardDuty + WAF to be enabled)"
  type        = bool
  default     = true
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for disabling compromised users"
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN for IAM permissions"
  type        = string
}

variable "sns_topic_arn" {
  description = "SNS topic ARN for remediation notifications"
  type        = string
  default     = null
}

variable "waf_web_acl_arn" {
  description = "WAF Web ACL ARN to attach the block rule to"
  type        = string
  default     = null
}

variable "log_retention_days" {
  description = "CloudWatch log retention for the remediation Lambda"
  type        = number
  default     = 14
}
