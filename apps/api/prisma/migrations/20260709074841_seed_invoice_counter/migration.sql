-- Seed the singleton invoice counter row (infrastructural, not demo data — must always exist)
INSERT INTO "invoice_counters" ("id", "lastValue") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;
