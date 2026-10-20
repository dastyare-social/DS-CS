CREATE TABLE "mcp_oauth_storage" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"server" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "mcp_oauth_storage_user_server_key_idx" ON "mcp_oauth_storage" USING btree ("user_id","server","key");--> statement-breakpoint
CREATE INDEX "mcp_oauth_storage_user_idx" ON "mcp_oauth_storage" USING btree ("user_id");