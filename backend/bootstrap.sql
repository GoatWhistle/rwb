-- Run explicitly as the database owner, including after rebuilding core.
BEGIN;
CREATE EXTENSION IF NOT EXISTS vector WITH SCHEMA public;
DO $$ BEGIN
  IF EXISTS (SELECT FROM pg_extension e JOIN pg_namespace n ON n.oid=e.extnamespace
             WHERE e.extname='vector' AND n.nspname<>'public') THEN
    ALTER EXTENSION vector SET SCHEMA public;
  END IF;
END $$;
CREATE SCHEMA IF NOT EXISTS ai;
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='agent_reader') THEN
    CREATE ROLE agent_reader LOGIN PASSWORD 'agent_local';
  END IF;
END $$;
ALTER ROLE agent_reader SET default_transaction_read_only = on;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA core, mart, ai TO agent_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA core, mart TO agent_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA core GRANT SELECT ON TABLES TO agent_reader;
ALTER DEFAULT PRIVILEGES IN SCHEMA mart GRANT SELECT ON TABLES TO agent_reader;
CREATE TABLE IF NOT EXISTS ai.review_embeddings (
 review_id text NOT NULL, order_id text NOT NULL,
 content text NOT NULL, content_hash text NOT NULL,
 model text NOT NULL, embedding public.vector(4096) NOT NULL,
 PRIMARY KEY(review_id, order_id)
);
-- Deliberately no FK to core: DROP SCHEMA core CASCADE must not delete the index.
CREATE TABLE IF NOT EXISTS ai.index_state (
 singleton boolean PRIMARY KEY DEFAULT true CHECK(singleton),
 model text NOT NULL, dimensions integer NOT NULL, corpus_hash text NOT NULL,
 indexed_at timestamptz NOT NULL DEFAULT now(), review_count integer NOT NULL
);
GRANT SELECT ON ALL TABLES IN SCHEMA ai TO agent_reader;
COMMIT;
