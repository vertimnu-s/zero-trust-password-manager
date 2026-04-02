# IAM Module Outputs - Role ARNs for Lambda functions

output "create_password_role_arn" {
  description = "ARN of IAM role for create password Lambda"
  value       = aws_iam_role.create_password_role.arn
}

output "read_passwords_role_arn" {
  description = "ARN of IAM role for read passwords Lambda"
  value       = aws_iam_role.read_passwords_role.arn
}

output "update_password_role_arn" {
  description = "ARN of IAM role for update password Lambda"
  value       = aws_iam_role.update_password_role.arn
}

output "delete_password_role_arn" {
  description = "ARN of IAM role for delete password Lambda"
  value       = aws_iam_role.delete_password_role.arn
}

output "all_lambda_role_names" {
  description = "Names of all Lambda IAM roles"
  value = {
    create = aws_iam_role.create_password_role.name
    read   = aws_iam_role.read_passwords_role.name
    update = aws_iam_role.update_password_role.name
    delete = aws_iam_role.delete_password_role.name
  }
}
