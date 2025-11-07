# Athena – AI-Powered Study Assistant

Athena is a serverless, AI-driven PDF summarizer that helps students quickly digest lecture materials. It extracts key information from uploaded PDFs and generates summaries, key terms, and quiz questions automatically.

## Current Status

* **Backend:** Fully functional
* **Frontend:** Partially functional (file upload and polling implemented, display integration pending)
* **Deployment:** Works end-to-end via AWS S3 and Lambda without the frontend

## Tech Stack

| Layer              | Tools & Services                              |
| ------------------ | --------------------------------------------- |
| **Backend**        | AWS Lambda (Python), S3, DynamoDB, OpenAI API |
| **Frontend**       | Next.js (in progress)                         |
| **Infrastructure** | Terraform (for AWS provisioning)              |

## How It Works

1. **Presigned Upload:**
   The frontend (or Postman) requests a presigned URL from the `athena-presigned` Lambda.

2. **Upload to S3:**
   The user uploads a PDF using the presigned URL to the S3 uploads bucket.

3. **Auto-Trigger Summarization:**
   S3 triggers the `athena-summarize` Lambda, which:

   * Extracts text from the PDF
   * Calls the OpenAI API
   * Saves structured results (summary, key terms, quiz questions) as JSON in the output bucket
   * Logs metadata to DynamoDB

4. **Retrieve Output:**
   The resulting JSON is stored in the S3 output bucket, ready for manual or frontend retrieval.

## Folder Structure

```
Athena/
│
├── frontend/               # Next.js client app (in development)
│   ├── app/
│   ├── components/
│   └── .env.local
│
├── backend/
│   ├── handler.py          # Athena summarization Lambda
│   ├── presign.py          # Presigned URL Lambda
│   └── requirements.txt
│
└── terraform/              # AWS IaC configuration
    ├── main.tf
    ├── variables.tf
    ├── outputs.tf
    └── provider.tf
```

## Environment Variables

### Backend (Lambda)

```
TABLE_NAME=athena-history
OUTPUT_BUCKET=athena-outputs-xxxxxxx
UPLOADS_BUCKET=athena-uploads-xxxxxxx
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxx
MODEL_NAME=gpt-5-nano
```

### Frontend (.env.local)

```
NEXT_PUBLIC_PRESIGNED_API=https://your-presigned-lambda-url.on.aws/
NEXT_PUBLIC_OUTPUT_BUCKET=athena-outputs-xxxxxxx
```

---

## Running Locally

### Backend (Lambda)

Install dependencies:

```bash
pip install -r requirements.txt -t .
```

Zip and upload the folder to AWS Lambda, then connect the S3 bucket trigger for `athena-summarize`.

### Frontend (optional for now)

```bash
cd frontend
npm install
npm run dev
```

Runs on [http://localhost:3000](http://localhost:3000)

## Security Notes

* Uses presigned S3 URLs for secure uploads
* Files are not publicly accessible by default
* OpenAI API keys are stored as environment variables in Lambda
* DynamoDB logs each processed PDF

## Future Improvements

* Complete frontend integration
* Add authenticated uploads (Cognito)
* Improve error handling and JSON validation
* Deploy via CI/CD (GitHub Actions)

## Author

**Rebecca Okine**
[LinkedIn](https://linkedin.com/in/rebeccaokine)
