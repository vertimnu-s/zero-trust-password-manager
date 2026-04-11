variable "project_name" {
  type = string
}

variable "environment" {
  type = string
}

variable "enabled" {
  type    = bool
  default = false
}

variable "audit_logs_bucket_name" {
  description = "S3 bucket name for Config delivery (reuses audit logs bucket)"
  type        = string
}

variable "audit_logs_bucket_arn" {
  description = "S3 bucket ARN for Config delivery IAM policy"
  type        = string
}

variable "guardduty_enabled" {
  description = "Whether GuardDuty is active (enables Security Hub integration)"
  type        = bool
  default     = false
}
