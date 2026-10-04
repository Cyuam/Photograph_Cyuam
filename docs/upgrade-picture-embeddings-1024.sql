-- Upgrade semantic picture search from 512-dimension vectors to 1024-dimension vectors.
--
-- This intentionally deletes existing picture embeddings. A 512-dimensional vector
-- cannot be mixed with 1024-dimensional query embeddings in the same pgvector
-- column. After running this SQL, run a full forced image embedding backfill.

begin;

delete from public.picture_embeddings;

alter table public.picture_embeddings
  alter column embedding type vector(1024);

create index if not exists picture_embeddings_embedding_idx
  on public.picture_embeddings
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

create or replace function public.match_pictures_by_embedding(
  query_embedding vector(1024),
  match_count integer default 12,
  min_similarity double precision default 0,
  min_lng double precision default null,
  min_lat double precision default null,
  max_lng double precision default null,
  max_lat double precision default null
)
returns setof public.pictures
language sql
stable
as $$
  select p.*
  from public.picture_embeddings pe
  join public.pictures p on p.id = pe.picture_id
  where 1 - (pe.embedding <=> query_embedding) >= min_similarity
  order by pe.embedding <=> query_embedding
  limit match_count;
$$;

commit;
