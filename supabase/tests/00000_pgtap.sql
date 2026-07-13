create schema if not exists extensions;
create extension if not exists pgtap with schema extensions;

begin;

select plan(1);
select ok(true, 'pgTAP is installed and available to database contract tests');
select * from finish();

rollback;
