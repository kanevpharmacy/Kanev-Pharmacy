-- Kanev Pharmacy: explicit Main menu > Category > Subcategory hierarchy.
-- Safe to run after kanev_store_menu_migration.sql. Does not modify product/category records.

alter table public.store_menu_items
  add column if not exists node_type text not null default 'menu';

-- Backfill existing navigation rows according to their current tree depth.
with recursive tree as (
  select id, parent_id, 0 as depth from public.store_menu_items where parent_id is null
  union all
  select child.id, child.parent_id, parent.depth + 1
  from public.store_menu_items child
  join tree parent on child.parent_id = parent.id
)
update public.store_menu_items item
set node_type = case
  when tree.depth = 0 then 'menu'
  when tree.depth = 1 then 'category'
  else 'subcategory'
end
from tree
where item.id = tree.id;

alter table public.store_menu_items drop constraint if exists store_menu_items_node_type_check;
alter table public.store_menu_items
  add constraint store_menu_items_node_type_check
  check (node_type in ('menu','category','subcategory'));

create or replace function public.validate_store_menu_hierarchy()
returns trigger
language plpgsql
as $$
declare
  parent_type text;
  cycle_found boolean;
begin
  if new.node_type not in ('menu','category','subcategory') then
    raise exception 'Choose Main menu, Category or Subcategory';
  end if;

  if new.node_type = 'menu' then
    if new.parent_id is not null then
      raise exception 'A main menu cannot have a parent';
    end if;
  else
    if new.parent_id is null then
      raise exception 'A category or subcategory must have a parent';
    end if;
    if new.parent_id = new.id then
      raise exception 'A menu item cannot be its own parent';
    end if;
    select node_type into parent_type from public.store_menu_items where id = new.parent_id;
    if new.node_type = 'category' and parent_type <> 'menu' then
      raise exception 'A category must be under a main menu';
    end if;
    if new.node_type = 'subcategory' and parent_type <> 'category' then
      raise exception 'A subcategory must be under a category';
    end if;
  end if;

  with recursive descendants(id) as (
    select new.id
    union all
    select m.id from public.store_menu_items m
    join descendants d on m.parent_id = d.id
  )
  select exists(select 1 from descendants where id = new.parent_id) into cycle_found;
  if cycle_found then
    raise exception 'This parent would create a menu cycle';
  end if;
  return new;
end;
$$;

drop trigger if exists store_menu_items_prevent_cycle on public.store_menu_items;
drop trigger if exists store_menu_items_validate_hierarchy on public.store_menu_items;
create trigger store_menu_items_validate_hierarchy
before insert or update of parent_id, node_type on public.store_menu_items
for each row execute function public.validate_store_menu_hierarchy();

-- Ensure existing top-level navigation items are explicitly marked as main menus.
update public.store_menu_items set node_type='menu' where parent_id is null;
