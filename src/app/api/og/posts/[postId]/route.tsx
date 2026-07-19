import { ImageResponse } from "takumi-js/response";
import { readFile } from "fs/promises";
import { join } from "path";
import client_config from "../../../../../../config/app.config.json";
import { getPostById } from "@/lib/api/posts/queries";

export const dynamic = "force-dynamic";

/** @ignore OG image generation — not part of public REST API */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params;
  // Load the Pally font
  const fontPath = join(
    process.cwd(),
    "src/assets/fonts/en/Pally/Pally-Regular.ttf"
  );
  const fontData = await readFile(fontPath);

  // Load profile image
  const profileImagePath = join(process.cwd(), "public/profile-image.png");
  const profileImageData = await readFile(profileImagePath);
  const profileImageBase64 = `data:image/png;base64,${profileImageData.toString("base64")}`;

  // Load background image
  const bgImagePath = join(process.cwd(), "public/bg-image.png");
  const bgImageData = await readFile(bgImagePath);
  const bgImageBase64 = `data:image/png;base64,${bgImageData.toString("base64")}`;

  const appName = client_config.en.name;

  let postContent = "";
  let mediaTypeLabel = "";
  try {
    const post = await getPostById(postId);
    if (post?.content) {
      postContent = post.content;
      if (postContent.length > 200) {
        postContent = postContent.substring(0, 200) + "...";
      }
    }
    if (post?.media) {
      if (post.type === "image") mediaTypeLabel = "📷 Image";
      else if (post.type === "video") mediaTypeLabel = "🎬 Video";
      else if (post.type === "voice") mediaTypeLabel = "🎤 Voice";
    }
  } catch (e) {
    console.error("Error fetching post for OG:", e);
  }

  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "oklch(0.99 0 0)",
        backgroundImage: `url(${bgImageBase64})`,
        backgroundRepeat: "repeat",
        backgroundSize: "cover",
        backgroundPosition: "center",
        padding: "60px",
        position: "relative",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          padding: "60px",
          backgroundColor: "rgba(255, 255, 255, 0.7)",
          backdropFilter: "blur(20px)",
          borderRadius: "32px",
          border: "1px solid rgba(234, 88, 12, 0.15)",
          maxWidth: "1000px",
          width: "100%",
          height: "100%",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "32px" }}>
          <img
            src={profileImageBase64}
            alt="Profile"
            style={{
              width: "80px",
              height: "80px",
              borderRadius: "50%",
              objectFit: "cover",
              border: "3px solid rgba(234, 88, 12, 0.3)",
            }}
          />
          <div style={{ display: "flex", flexDirection: "column" }}>
            <h1
              style={{
                fontSize: "48px",
                fontWeight: 700,
                color: "oklch(0.24 0 0)",
                margin: 0,
                fontFamily: "Pally",
                letterSpacing: "-0.02em",
              }}
            >
              {appName}'s Channel
            </h1>
          </div>
        </div>

        <p
          style={{
            fontSize: "32px",
            color: "oklch(0.44 0.01 286)",
            lineHeight: 1.6,
            fontFamily: "Pally",
            letterSpacing: "-0.01em",
            flex: 1,
            margin: 0,
          }}
        >
          {postContent || "A post from " + appName}
        </p>

        {mediaTypeLabel && (
          <div
            style={{
              marginTop: "24px",
              padding: "16px 24px",
              backgroundColor: "rgba(234, 88, 12, 0.1)",
              borderRadius: "9999px",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <p
              style={{
                fontSize: "20px",
                color: "oklch(0.44 0.01 286)",
                fontFamily: "Pally",
                letterSpacing: "-0.01em",
                margin: 0,
              }}
            >
              {mediaTypeLabel}
            </p>
          </div>
        )}
      </div>
    </div>,
    {
      width: 1200,
      height: 630,
      fonts: [
        {
          name: "Pally",
          data: fontData,
          style: "normal",
          weight: 400,
        },
      ],
    }
  );
}
