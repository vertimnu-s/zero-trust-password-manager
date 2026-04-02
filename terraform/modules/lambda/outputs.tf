# Lambda Module Outputs

output "create_password_function_arn" {
  description = "ARN of create password Lambda function"
  value       = aws_lambda_function.create_password.arn
}

output "read_passwords_function_arn" {
  description = "ARN of read passwords Lambda function"
  value       = aws_lambda_function.read_passwords.arn
}

output "update_password_function_arn" {
  description = "ARN of update password Lambda function"
  value       = aws_lambda_function.update_password.arn
}

output "delete_password_function_arn" {
  description = "ARN of delete password Lambda function"
  value       = aws_lambda_function.delete_password.arn
}

output "create_password_function_name" {
  description = "Name of create password Lambda function"
  value       = aws_lambda_function.create_password.function_name
}

output "read_passwords_function_name" {
  description = "Name of read passwords Lambda function"
  value       = aws_lambda_function.read_passwords.function_name
}

output "update_password_function_name" {
  description = "Name of update password Lambda function"
  value       = aws_lambda_function.update_password.function_name
}

output "delete_password_function_name" {
  description = "Name of delete password Lambda function"
  value       = aws_lambda_function.delete_password.function_name
}

# Lambda permissions for API Gateway
output "create_password_invoke_permission" {
  description = "Lambda permission resource for create password"
  value       = aws_lambda_permission.create_apigw.id
}

output "read_passwords_invoke_permission" {
  description = "Lambda permission resource for read passwords"
  value       = aws_lambda_permission.read_apigw.id
}

output "update_password_invoke_permission" {
  description = "Lambda permission resource for update password"
  value       = aws_lambda_permission.update_apigw.id
}

output "delete_password_invoke_permission" {
  description = "Lambda permission resource for delete password"
  value       = aws_lambda_permission.delete_apigw.id
}
