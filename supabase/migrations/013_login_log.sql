-- v31: record sign-ins in the audit log (who opened the app, when, on what device).
-- Each person may only add a sign-in line for themselves; only management can read the log (existing policy).
drop policy if exists audit_login_insert on audit_log;
create policy audit_login_insert on audit_log for insert to authenticated
  with check (action = 'LOGIN' and entity = 'session' and actor_id = auth.uid());
grant insert on audit_log to authenticated;
