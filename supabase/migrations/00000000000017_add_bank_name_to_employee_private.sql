-- Add bank_name column to employee_private
alter table public.employee_private
add column if not exists bank_name text;

comment on column public.employee_private.bank_name is 'The name of the bank (e.g., HDFC, ICICI, Bank of Baroda). Distinct from bank_account_name which is the account holder name.';