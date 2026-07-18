CREATE TABLE "push_subscriptions" (
	"id" text PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"user_agent" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp,
	"updated_at" timestamp,
	CONSTRAINT "push_subscriptions_id_unique" UNIQUE("id"),
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
