-- backend/sql/pre_migration_safety_checks.sql
-- Run this before applying Part 1. It only reads data; it changes nothing.

SELECT 'users' AS table_name, COUNT(*) AS rows FROM public.users
UNION ALL SELECT 'courses', COUNT(*) FROM public.courses
UNION ALL SELECT 'course_students', COUNT(*) FROM public.course_students
UNION ALL SELECT 'typing_sessions', COUNT(*) FROM public.typing_sessions
UNION ALL SELECT 'certificates', COUNT(*) FROM public.certificates;

SELECT id, title, created_at, certificate_id
FROM public.typing_sessions
ORDER BY id DESC
LIMIT 10;

SELECT version_num
FROM public.alembic_version;
