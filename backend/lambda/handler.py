import os
import json
import time
import uuid
import tempfile
import http.client
import boto3
from PyPDF2 import PdfReader

# ENV
TABLE_NAME     = os.getenv("TABLE_NAME")
OUTPUT_BUCKET  = os.getenv("OUTPUT_BUCKET")
UPLOADS_BUCKET = os.getenv("UPLOADS_BUCKET")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
MODEL_NAME     = os.getenv("MODEL_NAME", "gpt-5-nano")

s3       = boto3.client("s3")
dynamodb = boto3.client("dynamodb")

SYSTEM_PROMPT = (
  "You are Athena, a precise study assistant for university students. "
  "Given the raw text from lecture slides, produce a compact JSON with fields:\n"
  "{\n"
  '  "summary": string (4-8 sentences),\n'
  '  "key_terms": string[] (6-12 items),\n'
  '  "quiz_questions": string[] (4-6 items)\n'
  "}\n"
  "Keep language clear, factual, and useful for revision."
)

def extract_text_from_pdf(bucket: str, key: str) -> str:
    print(f"[INFO] Downloading and extracting text from {bucket}/{key}")
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        s3.download_file(bucket, key, tmp.name)
        reader = PdfReader(tmp.name)
        parts = []
        for i, page in enumerate(reader.pages):
            t = page.extract_text()
            if t:
                parts.append(t)
            else:
                print(f"[WARN] No text found on page {i+1}")
        text = "\n".join(parts)
        print(f"[INFO] Extracted {len(text)} characters of text")
        return text

def call_openai_json(text: str) -> dict:
    print("[INFO] Calling OpenAI API...")
    conn = http.client.HTTPSConnection("api.openai.com")
    user_prompt = (
        "Extract key study material from the following lecture text and return ONLY valid JSON (no extra text):\n\n"
        f"{text[:8000]}"
    )
    payload = json.dumps({
        "model": MODEL_NAME,
        "response_format": { "type": "json_object" },
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": user_prompt}
        ]
    })
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {OPENAI_API_KEY}"
    }

    conn.request("POST", "/v1/chat/completions", payload, headers)
    res = conn.getresponse()
    raw = res.read().decode()
    print(f"[DEBUG] OpenAI API response code: {res.status}")
    if res.status >= 300:
        raise RuntimeError(f"OpenAI error {res.status}: {raw}")
    data = json.loads(raw)
    content = data["choices"][0]["message"]["content"]
    print("[INFO] OpenAI response received successfully.")
    return json.loads(content)

def lambda_handler(event, context):
    print("==== Athena Lambda started ====")
    print("[DEBUG] Incoming event:")
    print(json.dumps(event, indent=2))
    print("[DEBUG] OPENAI_API_KEY present:", bool(OPENAI_API_KEY))
    print("[DEBUG] MODEL_NAME:", MODEL_NAME)

    try:
        rec = event["Records"][0]
        bucket = rec["s3"]["bucket"]["name"]
        key    = rec["s3"]["object"]["key"]

        print(f"[INFO] Processing file: {key} from bucket: {bucket}")

        if bucket != UPLOADS_BUCKET or not key.lower().endswith(".pdf"):
            print("[INFO] Skipping non-PDF or wrong bucket event.")
            return {"statusCode": 200, "body": json.dumps({"skipped": True})}

        text = extract_text_from_pdf(bucket, key)
        if not text or len(text.strip()) < 20:
            raise ValueError("No extractable text found in PDF.")

        ai = call_openai_json(text)

        result_id = str(uuid.uuid4())
        out_key   = f"athena_{result_id}.json"
        payload = {
            "id": result_id,
            "source_pdf": key,
            "model": MODEL_NAME,
            "timestamp": int(time.time()),
            "summary": ai.get("summary", ""),
            "key_terms": ai.get("key_terms", []),
            "quiz_questions": ai.get("quiz_questions", [])
        }

        print(f"[INFO] Uploading output to {OUTPUT_BUCKET}/{out_key}")
        s3.put_object(
    Bucket=OUTPUT_BUCKET,
    Key=out_key,
    Body=json.dumps(payload, ensure_ascii=False, indent=2).encode("utf-8"),
    ContentType="application/json",
)

        print("[INFO] Writing metadata to DynamoDB table...")
        dynamodb.put_item(
            TableName=TABLE_NAME,
            Item={
                "id":         {"S": result_id},
                "timestamp":  {"N": str(payload["timestamp"])},
                "model":      {"S": payload["model"]},
                "source_pdf": {"S": key},
                "s3_key":     {"S": out_key}
            }
        )

        print("==== Athena Lambda completed successfully ====")
        return {"statusCode": 200, "body": json.dumps({"ok": True, "output_key": out_key})}

    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return {"statusCode": 500, "body": json.dumps({"error": str(e)})}
