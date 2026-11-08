-- 010: Customer Service role. Sees every order and customer (read only), moves orders along (status and notes only).
-- Run in two steps if the editor complains: first line alone, then the rest.
alter type user_role add value if not exists 'service';
