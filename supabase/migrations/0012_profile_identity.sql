alter table public.profiles
  add column avatar_path text null,
  add column avatar_color text;

update public.profiles
set avatar_color = (array[
  '#228BE6', '#15AABF', '#12B886', '#40C057',
  '#F59F00', '#E8590C', '#E64980', '#7950F2'
])[1 + mod(abs(hashtext(id::text)::bigint), 8)]
where avatar_color is null;

alter table public.profiles
  alter column avatar_color set not null;

alter table public.profiles
  add constraint profiles_avatar_color_six_digit_hex_check
  check (avatar_color ~ '^#[0-9A-F]{6}$');

alter table public.profiles
  drop column avatar_url;
