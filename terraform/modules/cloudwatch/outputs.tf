# CloudWatch Module Outputs

output "create_log_group_name" {
  description = "CloudWatch Log Group name for create password Lambda"
  value       = aws_cloudwatch_log_group.create_password.name
}

output "read_log_group_name" {
  description = "CloudWatch Log Group name for read passwords Lambda"
  value       = aws_cloudwatch_log_group.read_passwords.name
}

output "update_log_group_name" {
  description = "CloudWatch Log Group name for update password Lambda"
  value       = aws_cloudwatch_log_group.update_password.name
}

output "delete_log_group_name" {
  description = "CloudWatch Log Group name for delete password Lambda"
  value       = aws_cloudwatch_log_group.delete_password.name
}

output "api_gateway_log_group_name" {
  description = "CloudWatch Log Group name for API Gateway"
  value       = aws_cloudwatch_log_group.api_gateway.name
}

output "log_group_names" {
  description = "All CloudWatch log group names"
  value = {
    create      = aws_cloudwatch_log_group.create_password.name
    read        = aws_cloudwatch_log_group.read_passwords.name
    update      = aws_cloudwatch_log_group.update_password.name
    delete      = aws_cloudwatch_log_group.delete_password.name
    api_gateway = aws_cloudwatch_log_group.api_gateway.name
  }
}
