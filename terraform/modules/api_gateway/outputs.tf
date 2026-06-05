output "api_id" {
  description = "API Gateway HTTP API ID"
  value       = aws_apigatewayv2_api.password_manager.id
}

output "api_endpoint" {
  description = "API Gateway HTTP API endpoint URL (needed for VITE_API_URL)"
  value       = "${aws_apigatewayv2_api.password_manager.api_endpoint}/${aws_apigatewayv2_stage.default.name}"
}

output "api_endpoint_raw" {
  description = "API Gateway HTTP API endpoint URL without stage path (for CloudFront origin)"
  value       = aws_apigatewayv2_api.password_manager.api_endpoint
}

output "api_endpoint_protocol" {
  description = "API Gateway execution protocol"
  value       = aws_apigatewayv2_api.password_manager.protocol_type
}

output "stage_name" {
  description = "API Gateway stage name"
  value       = aws_apigatewayv2_stage.default.name
}

output "authorizer_id" {
  description = "JWT Authorizer ID"
  value       = aws_apigatewayv2_authorizer.cognito.id
}

output "execution_arn" {
  description = "API Gateway execution ARN for Lambda permissions"
  value       = aws_apigatewayv2_api.password_manager.execution_arn
}
