INSERT INTO "service_transaction_counters" ("id", "lastValue") VALUES (1, 0) ON CONFLICT ("id") DO NOTHING;
