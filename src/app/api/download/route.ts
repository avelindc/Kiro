import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { generateR2PresignedDownloadUrl } from "@/lib/r2-helpers";
import { BUCKET_RELEASES, BUCKET_ASSETS, BUCKET_PROFILES } from "@/lib/r2";

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const url = searchParams.get("url");
    const filename = searchParams.get("filename") || "download";

    if (!url) {
      return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 });
    }

    // Extract R2 key from URL or path
    let key = url;
    if (key.includes("://")) {
      try {
        const u = new URL(key);
        key = u.pathname.replace(/^\/+/, "");
      } catch {
        key = url.replace(/^https?:\/\/[^\/]+\//, "");
      }
    }

    // Determine bucket based on key prefix
    let bucketsToTry = [BUCKET_RELEASES, BUCKET_ASSETS, BUCKET_PROFILES];
    if (key.startsWith("cms/") || key.startsWith("assets/")) {
      bucketsToTry = [BUCKET_ASSETS, BUCKET_RELEASES, BUCKET_PROFILES];
    } else if (key.startsWith("profiles/") || key.startsWith("avatars/")) {
      bucketsToTry = [BUCKET_PROFILES, BUCKET_RELEASES, BUCKET_ASSETS];
    } else if (key.startsWith("covers/") || key.startsWith("audio/") || key.startsWith("tracks/")) {
      bucketsToTry = [BUCKET_RELEASES, BUCKET_ASSETS, BUCKET_PROFILES];
    }

    // Try to generate presigned URL from each bucket
    for (const bucket of bucketsToTry) {
      const result = await generateR2PresignedDownloadUrl(bucket, key, 3600); // 1 hour expiry
      
      if (result.success && result.url) {
        console.log(`[Download API] Generated presigned URL for ${key} from bucket ${bucket}`);
        
        return NextResponse.json({
          success: true,
          url: result.url,
          filename: filename,
          expiresIn: 3600,
          message: "Presigned URL generated. Download directly from this URL."
        });
      }
    }

    // If presigned URL generation failed, return error
    console.error(`[Download API] Failed to generate presigned URL for ${key}`);
    return NextResponse.json(
      { 
        error: "Failed to generate download URL",
        key: key,
        bucketsChecked: bucketsToTry
      },
      { status: 404 }
    );

  } catch (error: any) {
    console.error("Download API error:", error);
    return NextResponse.json(
      { 
        error: "Internal Server Error",
        message: error.message 
      },
      { status: 500 }
    );
  }
}