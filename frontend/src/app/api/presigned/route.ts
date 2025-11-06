import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();

    console.log("Incoming data:", body);

    return NextResponse.json({ message: "Received successfully" });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
