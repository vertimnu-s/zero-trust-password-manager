# Cognito Module Outputs - Values needed by other modules and frontend

output "user_pool_id" {
  description = "Cognito User Pool ID (needed for VITE_COGNITO_USER_POOL_ID)"
  value       = aws_cognito_user_pool.main.id
}

output "user_pool_arn" {
  description = "Cognito User Pool ARN"
  value       = aws_cognito_user_pool.main.arn
}

output "client_id" {
  description = "Cognito App Client ID (needed for VITE_COGNITO_CLIENT_ID)"
  value       = aws_cognito_user_pool_client.frontend.client_id
}

output "user_pool_name" {
  description = "Cognito User Pool name"
  value       = aws_cognito_user_pool.main.name
}

output "user_pool_endpoint" {
  description = "Cognito User Pool endpoint for SDK configuration"
  value       = aws_cognito_user_pool.main.endpoint
}
