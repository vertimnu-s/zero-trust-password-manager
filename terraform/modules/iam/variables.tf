variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table"
  type        = string
}

variable "dynamodb_table_name" {
  description = "Name of the DynamoDB table"
  type        = string
}

variable "s3_audit_logs_bucket_arn" {
  description = "ARN of the S3 bucket for audit logs"
  type        = string
}

variable "kms_key_arns" {
  description = "List of KMS CMK ARNs the Lambda roles need access to (empty = no KMS permissions)"
  type        = list(string)
  default     = []
}

variable "dlq_arns" {
  description = "Map of function name to SQS DLQ ARN (empty = no DLQ permissions)"
  type        = map(string)
  default     = {}
}
