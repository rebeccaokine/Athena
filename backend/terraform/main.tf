terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.6.0"
    }
    archive = {
      source = "hashicorp/archive"
    }
  }
}

provider "aws" {
  region = var.region
}

locals {
  uploads_bucket = "${var.project_name}-uploads-${random_id.suffix.hex}"
  outputs_bucket = "${var.project_name}-outputs-${random_id.suffix.hex}"
  lambda_name    = "${var.project_name}-summarize"
  table_name     = "${var.project_name}-history"
}

resource "random_id" "suffix" {
  byte_length = 4
}

# DynamoDB: store metadata/history
resource "aws_dynamodb_table" "history" {
  name         = local.table_name
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "id"

  attribute {
    name = "id"
    type = "S"
  }
}

# S3 buckets: uploads (PDFs) and outputs (JSON)
resource "aws_s3_bucket" "uploads" {
  bucket        = local.uploads_bucket
  force_destroy = true
}

resource "aws_s3_bucket" "outputs" {
  bucket        = local.outputs_bucket
  force_destroy = true
}

# Basic public-block on buckets (good practice)
resource "aws_s3_bucket_public_access_block" "uploads_pab" {
  bucket                  = aws_s3_bucket.uploads.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_public_access_block" "outputs_pab" {
  bucket                  = aws_s3_bucket.outputs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Lambda IAM role + policy
resource "aws_iam_role" "lambda_exec" {
  name = "${var.project_name}-lambda-role"
  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "lambda.amazonaws.com" },
      Action   = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_policy" "lambda_policy" {
  name   = "${var.project_name}-lambda-policy"
  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect: "Allow",
        Action: [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ],
        Resource: "arn:aws:logs:*:*:*"
      },
      {
        Effect: "Allow",
        Action: ["dynamodb:PutItem"],
        Resource: aws_dynamodb_table.history.arn
      },
      {
        Effect: "Allow",
        Action: ["s3:GetObject","s3:PutObject"],
        Resource: [
          "${aws_s3_bucket.uploads.arn}/*",
          "${aws_s3_bucket.outputs.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "attach" {
  role       = aws_iam_role.lambda_exec.name
  policy_arn = aws_iam_policy.lambda_policy.arn
}

# Build the Lambda zip (produced by package.sh). Terraform reads it.
data "archive_file" "lambda_zip" {
  type        = "zip"
  source_dir  = "${path.module}/../lambda/build"
  output_path = "${path.module}/../lambda/build.zip"
}

resource "aws_lambda_function" "summarize" {
  function_name = local.lambda_name
  role          = aws_iam_role.lambda_exec.arn
  handler       = "handler.lambda_handler"
  runtime       = "python3.11"
  filename      = data.archive_file.lambda_zip.output_path
  timeout       = 60
  memory_size   = 1024

  environment {
    variables = {
      TABLE_NAME     = aws_dynamodb_table.history.name
      OUTPUT_BUCKET  = aws_s3_bucket.outputs.bucket
      UPLOADS_BUCKET = aws_s3_bucket.uploads.bucket
      OPENAI_API_KEY = var.openai_api_key   # or leave blank and set later
      MODEL_NAME     = "gpt-4o-mini"
    }
  }

  depends_on = [
    aws_iam_role_policy_attachment.attach
  ]
}

# Allow S3 to trigger Lambda on new PDF uploads
resource "aws_lambda_permission" "allow_s3_invoke" {
  statement_id  = "AllowS3Invoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.summarize.function_name
  principal     = "s3.amazonaws.com"
  source_arn    = aws_s3_bucket.uploads.arn
}

resource "aws_s3_bucket_notification" "uploads_events" {
  bucket = aws_s3_bucket.uploads.id

  lambda_function {
    lambda_function_arn = aws_lambda_function.summarize.arn
    events              = ["s3:ObjectCreated:*"]
    filter_suffix       = ".pdf"
  }

  depends_on = [aws_lambda_permission.allow_s3_invoke]
}

output "uploads_bucket" { value = aws_s3_bucket.uploads.bucket }
output "outputs_bucket" { value = aws_s3_bucket.outputs.bucket }
output "history_table"  { value = aws_dynamodb_table.history.name }
output "lambda_name"    { value = aws_lambda_function.summarize.function_name }
