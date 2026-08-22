-- Product AI was removed. Migration 011 remains immutable in the ledger, so
-- a forward migration removes conversation data and every live table.
-- Do not use CASCADE: an unexpected dependency must stop the release.

DROP TABLE ai_messages;
DROP TABLE ai_conversations;
DROP TABLE ai_consents;
