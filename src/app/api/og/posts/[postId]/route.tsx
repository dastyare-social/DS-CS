import { ImageResponse } from "takumi-js/response";
import { readFile } from "fs/promises";
import { join } from "path";
import client_config from "../../../../../../config/app.config.json";
import { getPostById, countPosts } from "@/lib/api/posts/queries";

export const dynamic = "force-dynamic";

function formatPostDate(date: Date | null): string {
  if (!date) return "";
  const d = new Date(date);
  const day = d.getDate();
  const month = d.toLocaleString("en-US", { month: "long" });
  const year = d.getFullYear();
  const hours = d.getHours();
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 || 12;
  return `${day} ${month} ${year} — ${h} ${ampm}`;
}

/** @ignore OG image generation — not part of public REST API */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ postId: string }> },
) {
  const { postId } = await params;

  const fontPath = join(
    process.cwd(),
    "src/assets/fonts/en/Pally/Pally-Regular.ttf",
  );
  const fontData = await readFile(fontPath);

  const profileImagePath = join(process.cwd(), "public/profile-image.png");
  const profileImageData = await readFile(profileImagePath);
  const profileImageBase64 = `data:image/png;base64,${profileImageData.toString("base64")}`;

  const bgImagePath = join(process.cwd(), "public/bg-image.png");
  const bgImageData = await readFile(bgImagePath);
  const bgImageBase64 = `data:image/png;base64,${bgImageData.toString("base64")}`;

  const appName = client_config.en.name;

  let postContent = "";
  let postDate = "";
  let postViews = "0";
  let totalPosts = 0;
  let mediaTypeLabel = "";

  try {
    const [post, count] = await Promise.all([
      getPostById(postId),
      countPosts(),
    ]);
    totalPosts = count;

    if (post) {
      if (post.content) {
        postContent = post.content;
        if (postContent.length > 200) {
          postContent = postContent.substring(0, 200) + "...";
        }
      }
      postDate = formatPostDate(post.createdAt);
      postViews = post.views || "0";

      if (post.media) {
        if (post.type === "image") mediaTypeLabel = "Image";
        else if (post.type === "video") mediaTypeLabel = "Video";
        else if (post.type === "voice") mediaTypeLabel = "Voice";
      }
    }
  } catch (e) {
    console.error("Error fetching post for OG:", e);
  }

  return new ImageResponse(
    (
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
            alignItems: "center",
            justifyContent: "center",
            padding: "60px",
            backgroundColor: "rgba(255, 255, 255, 0.5)",
            backdropFilter: "blur(2px)",
            border: "2px solid rgba(234, 88, 12, 0.1)",
            maxWidth: "100%",
            width: "100%",
            height: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              maxWidth: "1800px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "35px",
                marginBottom: "32px",
              }}
            >
              <img
                src={profileImageBase64}
                alt="Profile"
                style={{
                  width: "250px",
                  height: "250px",
                  borderRadius: "50%",
                  padding: "10px",
                  objectFit: "cover",
                  border: "5px solid rgba(234, 88, 12, 0.15)",
                }}
              />
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <h1
                    style={{
                      fontSize: "85px",
                      fontWeight: 400,
                      color: "oklch(0.24 0 0)",
                      margin: 0,
                      fontFamily: "Pally",
                      letterSpacing: "-2.5px",
                    }}
                  >
                    {appName}'s Channel
                  </h1>

                  <div
                    style={{
                      fontSize: "55px",
                      fontWeight: 400,
                      color: "oklch(0.24 0 0)",
                      margin: 0,
                      opacity: 0.8,
                      fontFamily: "Pally",
                      letterSpacing: "-2.5px",
                    }}
                  >
                    — {totalPosts} Posts Published
                  </div>
                </div>

                {postDate && (
                  <div
                    style={{
                      fontSize: "55px",
                      fontWeight: 400,
                      color: "oklch(0.24 0 0)",
                      margin: 0,
                      opacity: 0.8,
                      fontFamily: "Pally",
                      letterSpacing: "-2.5px",
                    }}
                  >
                    — Posted {postDate}
                  </div>
                )}
              </div>
            </div>

            <p
              style={{
                fontSize: "65px",
                color: "oklch(0.24 0 0)",
                lineHeight: 1.5,
                fontFamily: "Pally",
                opacity: 0.8,
                letterSpacing: "-2px",
                flex: 1,
                margin: 0,
              }}
            >
              {postContent || "A post from " + appName}
            </p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "24px",
                fontSize: "55px",
                fontWeight: 400,
                color: "oklch(0.24 0 0)",
                margin: 0,
                opacity: 0.8,
                fontFamily: "Pally",
                letterSpacing: "-2.5px",
              }}
            >
              <span>{postViews} views</span>
              {mediaTypeLabel && <span>— {mediaTypeLabel}</span>}
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: 2400,
      height: 1260,
      fonts: [
        {
          name: "Pally",
          data: fontData,
          style: "normal",
          weight: 400,
        },
      ],
    },
  );
}
