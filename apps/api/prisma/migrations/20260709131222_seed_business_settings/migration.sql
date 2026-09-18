-- Seed the singleton business settings row (infrastructural, not demo data — must always exist)
INSERT INTO "business_settings" ("id", "updatedAt") VALUES (1, now()) ON CONFLICT ("id") DO NOTHING;
