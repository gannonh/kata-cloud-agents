CREATE TYPE "public"."actor_type" AS ENUM('user', 'agent');--> statement-breakpoint
ALTER TABLE "spec_versions" ALTER COLUMN "version_number" SET DATA TYPE integer;--> statement-breakpoint
ALTER TABLE "spec_versions" ADD COLUMN "actor_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "spec_versions" ADD COLUMN "actor_type" "actor_type" NOT NULL;--> statement-breakpoint
ALTER TABLE "spec_versions" ADD COLUMN "change_summary" text DEFAULT '' NOT NULL;