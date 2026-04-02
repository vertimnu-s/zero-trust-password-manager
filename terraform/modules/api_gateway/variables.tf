# API Gateway Module Variables

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "api_stage_name" {
  description = "API Gateway stage name (e.g., dev, prod)"
  type        = string
  default     = "dev"
}

variable "frontend_origin" {
  description = "Frontend origin for CORS (e.g., http://localhost:5173)"
  type        = string
}

variable "create_lambda_function_arn" {
  description = "ARN of create password Lambda"
  type        = string
}

variable "read_lambda_function_arn" {
  description = "ARN of read passwords Lambda"
  type        = string
}

variable "update_lambda_function_arn" {
  description = "ARN of update password Lambda"
  type        = string
}

variable "delete_lambda_function_arn" {
  description = "ARN of delete password Lambda"
  type        = string
}

variable "cognito_user_pool_id" {
  description = "Cognito User Pool ID for JWT authorizer"
  type        = string
}

variable "cognito_user_pool_arn" {
  description = "Cognito User Pool ARN"
  type        = string
}

variable "lambda_create_invoke_permission" {
  description = "Lambda invoke permission for create"
  type        = string
}

variable "lambda_read_invoke_permission" {
  description = "Lambda invoke permission for read"
  type        = string
}

variable "lambda_update_invoke_permission" {
  description = "Lambda invoke permission for update"
  type        = string
}

variable "lambda_delete_invoke_permission" {
  description = "Lambda invoke permission for delete"
  type        = string
}
