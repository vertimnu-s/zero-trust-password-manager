# S3 Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "enable_versioning" {
  description = "Enable versioning for S3 bucket"
  type        = bool
  default     = true
}

variable "audit_logs_retention_days" {
  description = "Number of days to retain audit logs before archiving"
  type        = number
  default     = 90
}

variable "archive_to_glacier_days" {
  description = "Move logs to Glacier after this many days (for cost optimization)"
  type        = number
  default     = 30
}

variable "kms_key_arn" {
  description = "KMS CMK ARN for server-side encryption (null = AES256)"
  type        = string
  default     = null
}
