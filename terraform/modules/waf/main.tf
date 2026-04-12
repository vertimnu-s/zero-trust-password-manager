# WAF + CloudFront — sits in front of API Gateway since WAF
# cannot attach directly to HTTP APIs, only REST/CloudFront/ALB.

terraform {
  required_providers {
    aws = {
      source = "hashicorp/aws"
    }
  }
}

resource "aws_wafv2_web_acl" "api_protection" {
  count = var.enabled ? 1 : 0

  name        = "${var.project_name}-waf-${var.environment}"
  description = "WAF protection for ${var.project_name} API"
  scope       = "CLOUDFRONT"

  default_action {
    allow {}
  }

  # Core Rule Set — XSS, path traversal, file inclusion, generic injections
  rule {
    name     = "aws-managed-common-rules"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesCommonRuleSet"
        vendor_name = "AWS"

        # Encrypted payloads can exceed the default 8KB body size limit
        rule_action_override {
          action_to_use {
            count {}
          }
          name = "SizeRestrictions_BODY"
        }
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-common-rules"
      sampled_requests_enabled   = true
    }
  }

  # Known Bad Inputs — Log4Shell, Java deserialization, host header attacks
  rule {
    name     = "aws-managed-known-bad-inputs"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesKnownBadInputsRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-known-bad-inputs"
      sampled_requests_enabled   = true
    }
  }

  # SQL Injection — catches injection patterns in params, body, headers
  rule {
    name     = "aws-managed-sql-injection"
    priority = 3

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesSQLiRuleSet"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-sqli-rules"
      sampled_requests_enabled   = true
    }
  }

  # IP Reputation — blocks known botnets, C&C servers, threat campaign IPs
  rule {
    name     = "aws-managed-ip-reputation"
    priority = 4

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        name        = "AWSManagedRulesAmazonIpReputationList"
        vendor_name = "AWS"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-ip-reputation"
      sampled_requests_enabled   = true
    }
  }

  # Incident response IP blocklist — highest priority, blocks IPs added by automated remediation
  dynamic "rule" {
    for_each = var.blocked_ip_set_arn != null ? [1] : []
    content {
      name     = "incident-response-blocked-ips"
      priority = 0

      action {
        block {
          custom_response {
            response_code            = 403
            custom_response_body_key = "blocked-ip"
          }
        }
      }

      statement {
        ip_set_reference_statement {
          arn = var.blocked_ip_set_arn
        }
      }

      visibility_config {
        cloudwatch_metrics_enabled = true
        metric_name                = "${var.project_name}-blocked-ips"
        sampled_requests_enabled   = true
      }
    }
  }

  # Per-IP rate limiting — blocks IPs exceeding threshold in a 5-min window
  rule {
    name     = "rate-limit-per-ip"
    priority = 5

    action {
      block {
        custom_response {
          response_code            = 429
          custom_response_body_key = "rate-limited"
        }
      }
    }

    statement {
      rate_based_statement {
        limit              = var.rate_limit_per_ip
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-rate-limit"
      sampled_requests_enabled   = true
    }
  }

  custom_response_body {
    key          = "rate-limited"
    content      = "{\"error\": \"Too many requests. Please try again later.\"}"
    content_type = "APPLICATION_JSON"
  }

  custom_response_body {
    key          = "blocked-ip"
    content      = "{\"error\": \"Access denied.\"}"
    content_type = "APPLICATION_JSON"
  }

  visibility_config {
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-waf-global"
    sampled_requests_enabled   = true
  }

  tags = {
    Name = "${var.project_name}-waf-${var.environment}"
  }
}

resource "aws_cloudfront_response_headers_policy" "security_headers" {
  count = var.enabled ? 1 : 0
  name  = "${var.project_name}-security-headers-${var.environment}"

  security_headers_config {
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = true
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=()"
      override = true
    }
    items {
      header   = "Cache-Control"
      value    = "no-store"
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "api_distribution" {
  count = var.enabled ? 1 : 0

  comment             = "${var.project_name} API protection layer"
  enabled             = true
  web_acl_id          = aws_wafv2_web_acl.api_protection[0].arn
  price_class         = "PriceClass_100"
  wait_for_deployment = false

  origin {
    domain_name = replace(replace(var.api_gateway_endpoint, "https://", ""), "/", "")
    origin_id   = "api-gateway"
    origin_path = "/${var.api_gateway_stage_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  default_cache_behavior {
    allowed_methods            = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods             = ["GET", "HEAD", "OPTIONS"]
    target_origin_id           = "api-gateway"
    response_headers_policy_id = aws_cloudfront_response_headers_policy.security_headers[0].id

    forwarded_values {
      query_string = true
      headers = [
        "Authorization",
        "Content-Type",
        "Origin",
        "Access-Control-Request-Method",
        "Access-Control-Request-Headers"
      ]

      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "https-only"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
    compress               = true
  }

  viewer_certificate {
    cloudfront_default_certificate = true
    minimum_protocol_version       = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  tags = {
    Name = "${var.project_name}-api-cdn-${var.environment}"
  }
}

# WAF logging — only blocked/counted requests are logged to save costs.
# Log group name must start with "aws-waf-logs-" per AWS requirements.
resource "aws_cloudwatch_log_group" "waf_logs" {
  count = var.enabled && var.enable_logging ? 1 : 0

  name              = "aws-waf-logs-${var.project_name}-${var.environment}"
  retention_in_days = var.log_retention_days

  tags = {
    Name = "${var.project_name}-waf-logs-${var.environment}"
  }
}

resource "aws_wafv2_web_acl_logging_configuration" "waf_logging" {
  count = var.enabled && var.enable_logging ? 1 : 0

  log_destination_configs = [aws_cloudwatch_log_group.waf_logs[0].arn]
  resource_arn            = aws_wafv2_web_acl.api_protection[0].arn

  logging_filter {
    default_behavior = "DROP"

    filter {
      behavior    = "KEEP"
      requirement = "MEETS_ANY"

      condition {
        action_condition {
          action = "BLOCK"
        }
      }

      condition {
        action_condition {
          action = "COUNT"
        }
      }
    }
  }
}

# Alarms — high block volume and rate limiting triggers
resource "aws_cloudwatch_metric_alarm" "waf_blocked_requests" {
  count = var.enabled ? 1 : 0

  alarm_name          = "${var.project_name}-waf-blocked-requests-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 100
  alarm_description   = "High volume of blocked requests — possible attack"
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = aws_wafv2_web_acl.api_protection[0].name
    Region = "us-east-1"
    Rule   = "ALL"
  }

  tags = {
    Name = "${var.project_name}-waf-alarm-${var.environment}"
  }
}

resource "aws_cloudwatch_metric_alarm" "waf_rate_limited" {
  count = var.enabled ? 1 : 0

  alarm_name          = "${var.project_name}-waf-rate-limited-${var.environment}"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "BlockedRequests"
  namespace           = "AWS/WAFV2"
  period              = 300
  statistic           = "Sum"
  threshold           = 50
  alarm_description   = "Rate limiting active — possible brute force attempt"
  treat_missing_data  = "notBreaching"

  dimensions = {
    WebACL = aws_wafv2_web_acl.api_protection[0].name
    Region = "us-east-1"
    Rule   = "${var.project_name}-rate-limit"
  }

  tags = {
    Name = "${var.project_name}-waf-rate-alarm-${var.environment}"
  }
}
