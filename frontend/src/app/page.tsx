"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent, CardTitle } from "@/components/ui/card";
import FloatingIcons from "@/components/ui/floatingIcons";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!file) return alert("Please select a PDF first.");
    setUploading(true);
    setResult(null);

    try {
      const PRESIGN_URL = process.env.NEXT_PUBLIC_PRESIGNED_API!;
      console.log("Requesting presigned upload URL from:", PRESIGN_URL);

      //Get presigned URL from Lambda
      const res = await fetch(PRESIGN_URL, { method: "GET" });
      if (!res.ok) throw new Error(`Presign API failed: ${res.status}`);
      const { upload_url, output_key } = await res.json();

      // 2️⃣ Upload file to S3
      console.log("Uploading PDF to S3...");
      const uploadRes = await fetch(upload_url, {
        method: "PUT",
        headers: { "Content-Type": "application/pdf" },
        body: file,
      });
      if (!uploadRes.ok) throw new Error("S3 upload failed");

      console.log("Upload complete. Waiting for Lambda to process...");

      // Wait before polling
      await new Promise((r) => setTimeout(r, 4000));

      // Build the correct public S3 output URL
      const s3OutputUrl = `https://athena-outputs-0d113c8c.s3.amazonaws.com/${output_key}`;
      console.log("Polling output URL:", s3OutputUrl);

      // Poll every 4 seconds for up to 2 minutes
      let jsonResult: any = null;
      for (let i = 0; i < 30; i++) {
        const check = await fetch(s3OutputUrl);
        if (check.ok) {
          try {
            const text = await check.text();
            jsonResult = JSON.parse(text);
          } catch {
            console.log("File not ready yet (still processing)...");
          }
          if (jsonResult?.summary) {
            console.log("✅ Summary file ready!");
            break;
          }
        } else {
          console.log(`Attempt ${i + 1}: JSON not ready yet...`);
        }
        await new Promise((r) => setTimeout(r, 4000));
      }

      if (!jsonResult)
        throw new Error("Timed out waiting for summary. Try again later.");

      setResult(jsonResult);
    } catch (err: any) {
      console.error("Upload failed:", err);
      alert(`Upload failed: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <main className="animated-bg relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
      <FloatingIcons />
      <Card className="max-w-lg w-full p-6 shadow-2xl bg-white/80 backdrop-blur-lg rounded-2xl border border-white/30 relative z-10">
        <CardHeader>
          <CardTitle className="text-4xl text-center font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-700 via-pink-500 to-blue-600">
            Athena
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          <p className="text-gray-700 text-lg">
            Upload your lecture PDF and get a friendly study summary
          </p>

          <input
            type="file"
            accept=".pdf"
            onChange={handleFileChange}
            className="w-full text-sm text-gray-700"
          />

          <Button
            onClick={handleUpload}
            className="bg-pink-400 hover:bg-pink-500 text-white rounded-full px-6 shadow-lg transition-all"
            disabled={uploading}
          >
            {uploading ? "Processing..." : "Upload & Summarize"}
          </Button>

          {result && (
            <div className="mt-6 text-left space-y-4 animate-fadeIn">
              <h2 className="font-semibold text-purple-700 text-xl">Summary</h2>
              <p className="text-gray-700 whitespace-pre-line">
                {result.summary}
              </p>

              {result.key_terms && result.key_terms.length > 0 && (
                <>
                  <h3 className="font-semibold text-blue-600 text-lg">
                    Key Terms
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.key_terms.map((term: string) => (
                      <span
                        key={term}
                        className="bg-blue-100 text-blue-700 text-sm px-3 py-1 rounded-full"
                      >
                        {term}
                      </span>
                    ))}
                  </div>
                </>
              )}

              {result.quiz_questions && result.quiz_questions.length > 0 && (
                <>
                  <h3 className="font-semibold text-pink-600 text-lg">
                    Quiz Questions
                  </h3>
                  <ul className="list-disc pl-6 text-gray-700 space-y-1">
                    {result.quiz_questions.map((q: string, i: number) => (
                      <li key={i}>{q}</li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
