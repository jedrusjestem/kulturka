-- Nadanie roli ADMINISTRATORA istniejącemu kontu.
-- 1) Najpierw uruchom ponownie cały plik schema.sql (dodaje rolę 'admin').
-- 2) Wpisz swój e-mail poniżej i uruchom ten plik w Supabase → SQL Editor.
update public.profiles
   set role = 'admin', approved_at = coalesce(approved_at, now())
 where lower(email) = lower('TWOJ_EMAIL@student.pwr.edu.pl');

select full_name, email, role from public.profiles order by created_at;
