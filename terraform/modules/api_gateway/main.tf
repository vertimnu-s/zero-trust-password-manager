# API Gateway Module - HTTP API with JWT Authorizer

# Get current AWS account ID for Lambda URN construction
data "aws_caller_identity" "current" {}

# ========== CREATE HTTP API ==========
resource "aws_apigatewayv2_api" "password_manager" {
  name          = "${var.project_name}-api-${var.environment}"
  protocol_type = "HTTP"
  
  # CORS Configuration - handled natively by HTTP API
  cors_configuration {
    allow_origins = [var.frontend_origin]
    allow_methods = ["*"]
    allow_headers = ["Content-Type", "Authorization"]
    expose_headers = ["*"]
    max_age      = 300
    allow_credentials = false
  }

  tags = {
    Name = "${var.project_name}-api"
  }
}

# ========== JWT AUTHORIZER FOR COGNITO ==========
# This validates Cognito ID tokens on each request
resource "aws_apigatewayv2_authorizer" "cognito" {
  api_id           = aws_apigatewayv2_api.password_manager.id
  authorizer_type  = "JWT"
  identity_sources = ["$request.header.Authorization"]
  name             = "cognito-authorizer"
  
  jwt_configuration {
    audience       = [var.cognito_client_id]
    issuer         = "https://cognito-idp.eu-north-1.amazonaws.com/${var.cognito_user_pool_id}"
  }
}

# ========== CREATE ROUTES FOR LAMBDA FUNCTIONS ==========

# Route 1: POST /createPasswordItem
resource "aws_apigatewayv2_route" "create_password" {
  api_id             = aws_apigatewayv2_api.password_manager.id
  route_key          = "POST /createPasswordItem"
  target             = "integrations/${aws_apigatewayv2_integration.create_password.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Route 2: GET /getPasswordItems
resource "aws_apigatewayv2_route" "read_passwords" {
  api_id             = aws_apigatewayv2_api.password_manager.id
  route_key          = "GET /getPasswordItems"
  target             = "integrations/${aws_apigatewayv2_integration.read_passwords.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Route 3: PUT /updatePasswordItem
resource "aws_apigatewayv2_route" "update_password" {
  api_id             = aws_apigatewayv2_api.password_manager.id
  route_key          = "PUT /updatePasswordItem"
  target             = "integrations/${aws_apigatewayv2_integration.update_password.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# Route 4: DELETE /deletePasswordItem
resource "aws_apigatewayv2_route" "delete_password" {
  api_id             = aws_apigatewayv2_api.password_manager.id
  route_key          = "DELETE /deletePasswordItem"
  target             = "integrations/${aws_apigatewayv2_integration.delete_password.id}"
  authorization_type = "JWT"
  authorizer_id      = aws_apigatewayv2_authorizer.cognito.id
}

# ========== LAMBDA INTEGRATIONS ==========
# Each integration connects a route to a Lambda function

resource "aws_apigatewayv2_integration" "create_password" {
  api_id             = aws_apigatewayv2_api.password_manager.id
  integration_type   = "AWS_PROXY"
  payload_format_version = "2.0"
  integration_uri    = var.create_lambda_function_arn
}

resource "aws_apigatewayv2_integration" "read_passwords" {
  api_id             = aws_apigatewayv2_api.password_manager.id
  integration_type   = "AWS_PROXY"
  payload_format_version = "2.0"
  integration_uri    = var.read_lambda_function_arn
}

resource "aws_apigatewayv2_integration" "update_password" {
  api_id             = aws_apigatewayv2_api.password_manager.id
  integration_type   = "AWS_PROXY"
  payload_format_version = "2.0"
  integration_uri    = var.update_lambda_function_arn
}

resource "aws_apigatewayv2_integration" "delete_password" {
  api_id             = aws_apigatewayv2_api.password_manager.id
  integration_type   = "AWS_PROXY"
  payload_format_version = "2.0"
  integration_uri    = var.delete_lambda_function_arn
}

# ========== STAGE AND DEPLOYMENT ==========
# The stage is where the API is actually deployed

resource "aws_apigatewayv2_stage" "default" {
  api_id = aws_apigatewayv2_api.password_manager.id
  
  name   = var.api_stage_name
  auto_deploy = true  # Automatically deploy when changes are detected
  
  # Default route settings
  default_route_settings {
    detailed_metrics_enabled = true
    throttling_burst_limit   = 5000
    throttling_rate_limit    = 10000
  }

  # Access logging (optional - uncomment to enable)
  # access_log_settings {
  #   destination_arn = aws_cloudwatch_log_group.api_gateway.arn
  #   format = jsonencode({
  #     requestId    = "$context.requestId"
  #     ip           = "$context.identity.sourceIp"
  #     requestTime  = "$context.requestTime"
  #     httpMethod   = "$context.httpMethod"
  #     resourcePath = "$context.resourcePath"
  #     status       = "$context.status"
  #     protocol     = "$context.protocol"
  #     responseLength = "$context.responseLength"
  #   })
  # }

  tags = {
    Name = "${var.project_name}-stage-${var.api_stage_name}"
  }

  depends_on = [
    aws_apigatewayv2_route.create_password,
    aws_apigatewayv2_route.read_passwords,
    aws_apigatewayv2_route.update_password,
    aws_apigatewayv2_route.delete_password
  ]
}

# ========== LAMBDA PERMISSIONS FOR API GATEWAY INVOCATION ==========
# These allow API Gateway to invoke the Lambda functions

resource "aws_lambda_permission" "create_apigw" {
  statement_id   = "AllowAPIGatewayInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = var.create_lambda_function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${aws_apigatewayv2_api.password_manager.execution_arn}/*/*"
}

resource "aws_lambda_permission" "read_apigw" {
  statement_id   = "AllowAPIGatewayInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = var.read_lambda_function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${aws_apigatewayv2_api.password_manager.execution_arn}/*/*"
}

resource "aws_lambda_permission" "update_apigw" {
  statement_id   = "AllowAPIGatewayInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = var.update_lambda_function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${aws_apigatewayv2_api.password_manager.execution_arn}/*/*"
}

resource "aws_lambda_permission" "delete_apigw" {
  statement_id   = "AllowAPIGatewayInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = var.delete_lambda_function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${aws_apigatewayv2_api.password_manager.execution_arn}/*/*"
}
