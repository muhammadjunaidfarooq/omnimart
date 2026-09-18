-- Seed the singleton SKU counter row (infrastructural, not demo data — must always exist)
INSERT INTO "sku_counters" ("id", "lastValue") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;