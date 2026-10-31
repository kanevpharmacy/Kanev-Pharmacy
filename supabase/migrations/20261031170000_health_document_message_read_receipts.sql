-- Persistent per-message read receipts for prescription and lab-result conversations.
-- A message is marked read only when the opposite party opens that exact submission.
alter table public.customer_health_document_messages
  add column if not exists read_at timestamptz,
  add column if not exists read_by uuid references auth.users(id);

create or replace function public.mark_customer_health_document_messages_read(p_document_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_customer_id uuid;
  v_reader_role text;
  v_updated integer := 0;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select d.customer_id
    into v_customer_id
    from public.customer_health_documents d
   where d.id = p_document_id;

  if not found then
    raise exception 'Submission not found';
  end if;

  if v_customer_id = v_user_id then
    v_reader_role := 'admin';
  elsif exists (
    select 1 from public.admin_members am where am.user_id = v_user_id
  ) then
    v_reader_role := 'customer';
  else
    raise exception 'Not authorized to read this conversation';
  end if;

  update public.customer_health_document_messages m
     set read_at = now(),
         read_by = v_user_id
   where m.document_id = p_document_id
     and m.sender_role = v_reader_role
     and m.read_at is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke all on function public.mark_customer_health_document_messages_read(uuid)
  from public, anon;
grant execute on function public.mark_customer_health_document_messages_read(uuid)
  to authenticated;
