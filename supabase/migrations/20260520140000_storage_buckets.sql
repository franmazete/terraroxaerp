-- ════════════════════════════════════════════════════════════════════
-- terraroxa — Supabase Storage (buckets + policies)
-- Data: 2026-05-20
--
-- Estratégia: 2 buckets conforme decisão da Etapa 2.
--
-- 1) "operacao" (privado): documentos da OC — autorização, ticket,
--    laudo, NF, CT-e, comprovante de descarga, fatura. Acesso só por
--    usuário autenticado (cerealista vê tudo; transp vê só os arquivos
--    de OCs dela).
--
-- 2) "publico" (público leitura): fotos/avatars (motorista foto,
--    logos), conteúdo que pode ter URL aberta.
--
-- Convenção de paths (importante pras policies):
--   operacao/<oc_id>/<categoria>/<arquivo>
--   publico/motoristas/<motorista_id>/<arquivo>
-- ════════════════════════════════════════════════════════════════════

-- Bucket "operacao" — privado por padrão
insert into storage.buckets (id, name, public)
values ('operacao', 'operacao', false)
on conflict (id) do nothing;

-- Bucket "publico" — leitura pública
insert into storage.buckets (id, name, public)
values ('publico', 'publico', true)
on conflict (id) do nothing;

-- ─── Policies do "operacao" ──────────────────────────────────────────

-- SELECT: cerealista vê tudo; transp vê arquivos de OCs em que ela é dona
create policy "operacao_select_cerealista" on storage.objects
  for select using (
    bucket_id = 'operacao' and public.is_cerealista()
  );

create policy "operacao_select_transp" on storage.objects
  for select using (
    bucket_id = 'operacao' and
    public.is_transp() and
    exists (
      select 1 from public.ordens_carregamento o
      where o.transp_id = public.transp_id_atual()
        -- path pattern: <oc_id>/...
        and o.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

-- INSERT: cerealista pode subir em qualquer pasta; transp só em OCs dela
create policy "operacao_insert_cerealista" on storage.objects
  for insert with check (
    bucket_id = 'operacao' and public.is_cerealista()
  );

create policy "operacao_insert_transp" on storage.objects
  for insert with check (
    bucket_id = 'operacao' and
    public.is_transp() and
    exists (
      select 1 from public.ordens_carregamento o
      where o.transp_id = public.transp_id_atual()
        and o.id::text = split_part(storage.objects.name, '/', 1)
    )
  );

-- UPDATE / DELETE: apenas cerealista (substituir documento é via versão nova)
create policy "operacao_update_cerealista" on storage.objects
  for update using (
    bucket_id = 'operacao' and public.is_cerealista()
  );

create policy "operacao_delete_cerealista" on storage.objects
  for delete using (
    bucket_id = 'operacao' and public.is_cerealista()
  );

-- ─── Policies do "publico" ───────────────────────────────────────────

-- SELECT: livre (bucket é public, mas mantém policy explícita)
create policy "publico_select_all" on storage.objects
  for select using (bucket_id = 'publico');

-- INSERT: qualquer logado pode subir (avatar, foto motorista)
create policy "publico_insert_logado" on storage.objects
  for insert with check (
    bucket_id = 'publico' and auth.uid() is not null
  );

-- UPDATE / DELETE: dono do arquivo (owner) ou cerealista
create policy "publico_update_owner_ou_cerealista" on storage.objects
  for update using (
    bucket_id = 'publico' and (owner = auth.uid() or public.is_cerealista())
  );

create policy "publico_delete_owner_ou_cerealista" on storage.objects
  for delete using (
    bucket_id = 'publico' and (owner = auth.uid() or public.is_cerealista())
  );
