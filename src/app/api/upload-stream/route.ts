import { NextRequest } from "next/server";
import {
  MediaValidationError,
  requireMediaAuth,
  uploadFileToS3Stream,
} from "@/lib/media";
import { isDemoMode } from "@/lib/demo-mode";

export const dynamic = "force-dynamic";

/**
 * Streaming upload with real-time progress via SSE
 * @summary Upload Media — Streaming with Progress
 * @description Upload a single media file with server-side progress tracking.
 * Returns Server-Sent Events: `progress` events (0-100) during S3 upload,
 * then a final `done` event with the uploaded media metadata, or `error` event.
 * @tag Media
 * @contentType multipart/form-data
 * @response 200 - SSE stream with progress/done/error events
 * @response 400 - Invalid request
 * @response 403 - Demo mode active
 * @response 500 - Server error
 * @openapi
 */
export async function POST(request: NextRequest) {
  const authError = await requireMediaAuth(request);
  if (authError) return authError;

  if (isDemoMode()) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: "Read-only demo mode is active" })}\n\n`,
      { status: 403, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  try {
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: "Content-Type must be multipart/form-data" })}\n\n`,
        { status: 400, headers: { "Content-Type": "text/event-stream" } },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: "No file provided (field name: file)" })}\n\n`,
        { status: 400, headers: { "Content-Type": "text/event-stream" } },
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: unknown) => {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        };

        try {
          const uploaded = await uploadFileToS3Stream(file, (percent) => {
            send("progress", { percent });
          });

          send("done", uploaded);
          controller.close();
        } catch (err: unknown) {
          console.error("POST /api/upload-stream error", err);
          const message =
            err instanceof Error ? err.message : "Internal Server Error";
          send("error", { error: message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err: unknown) {
    console.error("POST /api/upload-stream error", err);
    if (err instanceof MediaValidationError) {
      return new Response(
        `event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`,
        { status: err.status, headers: { "Content-Type": "text/event-stream" } },
      );
    }
    const message =
      err instanceof Error ? err.message : "Internal Server Error";
    return new Response(
      `event: error\ndata: ${JSON.stringify({ error: message })}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } },
    );
  }
}
