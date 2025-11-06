import boto3
import os
import json

s3 = boto3.client("s3")
UPLOADS_BUCKET = os.getenv("UPLOADS_BUCKET")

def lambda_handler(event, context):
    try:
        params = event.get("queryStringParameters", {}) or {}
        file_name = params.get("file_name", "")
        if not file_name:
            return {"statusCode": 400, "body": json.dumps({"error": "Missing file_name"})}
        if not file_name.endswith(".pdf"):
            return {"statusCode": 400, "body": json.dumps({"error": "Only PDFs allowed"})}

        presigned_url = s3.generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": UPLOADS_BUCKET,
                "Key": file_name,
                "ContentType": "application/pdf"
            },
            ExpiresIn=300  # 5 minutes
        )

        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"upload_url": presigned_url})
        }
    except Exception as e:
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
