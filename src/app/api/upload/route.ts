import { NextRequest, NextResponse } from "next/server";
import { uploadToS3, buildPublicFileUrl } from "@/lib/api/posts/mutations";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Upload file to S3
    const key = await uploadToS3(file, file.type);
    
    // Build public URL
    const url = buildPublicFileUrl(key);

    return NextResponse.json({ url, key });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
