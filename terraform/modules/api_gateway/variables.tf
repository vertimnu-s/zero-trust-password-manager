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

variable "create_lambda_function_name" {

  description = "Name of create password Lambda"
  type        = string
}

variable "read_lambda_function_name" {
  description = "Name of read passwords Lambda"
  type        = string
}

variable "update_lambda_function_name" {
  description = "Name of update password Lambda"
  type        = string
}

variable "delete_lambda_function_name" {
  description = "Name of delete password Lambda"
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

variable "cognito_client_id" {
  description = "Cognito App Client ID for JWT audience"
  type        = string
}

variable "api_gateway_log_group_arn" {
  description = "CloudWatch Log Group ARN for API Gateway access logging"
  type        = string
}
