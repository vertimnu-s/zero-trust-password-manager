# Lambda Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "create_lambda_role_arn" {
  description = "IAM role ARN for create password Lambda"
  type        = string
}

variable "read_lambda_role_arn" {
  description = "IAM role ARN for read passwords Lambda"
  type        = string
}

variable "update_lambda_role_arn" {
  description = "IAM role ARN for update password Lambda"
  type        = string
}

variable "delete_lambda_role_arn" {
  description = "IAM role ARN for delete password Lambda"
  type        = string
}

variable "dynamodb_table_name" {
  description = "DynamoDB table name for password vault"
  type        = string
}

variable "s3_audit_logs_bucket_name" {
  description = "S3 bucket name for audit logs"
  type        = string
}

variable "timeout_seconds" {
  description = "Lambda function timeout in seconds"
  type        = number
  default     = 30
}

variable "memory_mb" {
  description = "Lambda function memory in MB"
  type        = number
  default     = 256
}

variable "create_log_group_name" {
  description = "CloudWatch Log Group name for create Lambda"
  type        = string
}

variable "read_log_group_name" {
  description = "CloudWatch Log Group name for read Lambda"
  type        = string
}

variable "update_log_group_name" {
  description = "CloudWatch Log Group name for update Lambda"
  type        = string
}

variable "delete_log_group_name" {
  description = "CloudWatch Log Group name for delete Lambda"
  type        = string
}
