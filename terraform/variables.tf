variable "aws_region" {
  description = "AWS region for resources"
  type        = string
  default     = "eu-north-1"
}

variable "project_name" {
  description = "Project name for tagging and naming resources"
  type        = string
  default     = "zero-trust-password-manager"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "frontend_origin" {
  description = "Frontend origin for CORS (e.g., http://localhost:5173)"
  type        = string
  default     = "http://localhost:5173"
}

variable "api_stage_name" {
  description = "API Gateway stage name"
  type        = string
  default     = "dev"
}

# Cognito variables
variable "cognito_password_min_length" {
  description = "Minimum password length for Cognito"
  type        = number
  default     = 12
}

variable "cognito_mfa_enabled" {
  description = "Enable MFA for Cognito User Pool"
  type        = bool
  default     = true
}

variable "cognito_enable_passkeys" {
  description = "Enable passkeys for Cognito User Pool"
  type        = bool
  default     = true
}

# DynamoDB variables
variable "dynamodb_billing_mode" {
  description = "DynamoDB billing mode (PAY_PER_REQUEST or PROVISIONED)"
  type        = string
  default     = "PAY_PER_REQUEST"
}

variable "enable_point_in_time_recovery" {
  description = "Enable point-in-time recovery for DynamoDB"
  type        = bool
  default     = true
}

# Lambda variables
variable "lambda_timeout_seconds" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "lambda_memory_mb" {
  description = "Lambda function memory in MB"
  type        = number
  default     = 256
}

# S3 variables
variable "s3_enable_versioning" {
  description = "Enable versioning for S3 audit logs bucket"
  type        = bool
  default     = true
}

variable "s3_audit_logs_retention_days" {
  description = "Number of days to retain audit logs in S3"
  type        = number
  default     = 90
}

# Tags
variable "additional_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}

# ========== PAID SECURITY SERVICES ==========
# Master toggle — set to false to disable ALL paid security services at once.
# Individual toggles below override this if you need finer control.
variable "enable_paid_security" {
  description = "Master toggle for all paid security services (WAF, GuardDuty, CloudTrail)"
  type        = bool
  default     = true
}

# WAF variables
variable "waf_enabled" {
  description = "Toggle WAF + CloudFront on/off (defaults to master toggle)"
  type        = bool
  default     = null
}

variable "waf_rate_limit_per_ip" {
  description = "Maximum requests per 5-minute window per IP address"
  type        = number
  default     = 2000
}

variable "waf_enable_logging" {
  description = "Enable WAF request logging to CloudWatch"
  type        = bool
  default     = true
}

variable "waf_log_retention_days" {
  description = "Number of days to retain WAF logs in CloudWatch"
  type        = number
  default     = 30
}

# Security monitoring variables
variable "guardduty_enabled" {
  description = "Toggle GuardDuty threat detection on/off (defaults to master toggle)"
  type        = bool
  default     = null
}

variable "cloudtrail_enabled" {
  description = "Toggle CloudTrail audit logging on/off (defaults to master toggle)"
  type        = bool
  default     = null
}

variable "kms_enabled" {
  description = "Toggle KMS customer-managed keys on/off (defaults to master toggle)"
  type        = bool
  default     = null
}

variable "compliance_enabled" {
  description = "Toggle Security Hub + AWS Config on/off (defaults to master toggle)"
  type        = bool
  default     = null
}

variable "security_alert_email" {
  description = "Email address for security alerts (GuardDuty, alarms)"
  type        = string
}
