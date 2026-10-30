-- Platform-role RBAC redesign: "karyawan" was a duplicate label for the same
-- "Staf Internal" concept as "employee" — consolidate onto one slug so the
-- role dropdown, allowRoles gates, and nav allow-lists only need to handle
-- "employee" going forward. Not a schema change (User.role is a free-form
-- String column, no enum to alter) — landed here anyway so it runs exactly
-- once per environment via the same deploy-time mechanism as the other
-- files in this directory, before the app's first request after deploy.
-- Idempotent: a second run matches zero rows. (The User model maps to the
-- "users" table via @@map, see prisma/schema.prisma.)
UPDATE "users" SET role = 'employee' WHERE role = 'karyawan';
