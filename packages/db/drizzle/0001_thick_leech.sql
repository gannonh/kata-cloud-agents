ALTER TABLE "specs" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "specs" ALTER COLUMN "status" SET DEFAULT 'draft'::text;--> statement-breakpoint
UPDATE "specs"
SET "status" = CASE "status"
	WHEN 'active' THEN 'in_progress'
	WHEN 'paused' THEN 'in_progress'
	WHEN 'completed' THEN 'done'
	WHEN 'archived' THEN 'done'
	ELSE "status"
END;--> statement-breakpoint
DROP TYPE "public"."spec_status";--> statement-breakpoint
CREATE TYPE "public"."spec_status" AS ENUM('draft', 'approved', 'in_progress', 'verifying', 'done', 'failed');--> statement-breakpoint
ALTER TABLE "specs" ALTER COLUMN "status" SET DEFAULT 'draft'::"public"."spec_status";--> statement-breakpoint
ALTER TABLE "specs" ALTER COLUMN "status" SET DATA TYPE "public"."spec_status" USING "status"::"public"."spec_status";
