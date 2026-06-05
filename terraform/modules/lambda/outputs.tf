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
