# DynamoDB Module Outputs

output "table_name" {
  description = "DynamoDB table name for Lambda environment variables"
  value       = aws_dynamodb_table.password_vault.name
}

output "table_arn" {
  description = "DynamoDB table ARN for IAM policies"
  value       = aws_dynamodb_table.password_vault.arn
}

output "table_stream_arn" {
  description = "DynamoDB table stream ARN (if streams enabled)"
  value       = try(aws_dynamodb_table.password_vault.stream_arn, null)
}

output "table_region" {
  description = "AWS region where table is located"
  value       = aws_dynamodb_table.password_vault.billing_mode == "PROVISIONED" ? "Check AWS Console" : "On-demand"
}
