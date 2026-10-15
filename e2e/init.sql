-- Rollen und Platzhalter, die ein echtes Supabase-Projekt schon mitbringt.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create role authenticator login noinherit password 'auth';
grant anon, authenticated, service_role to authenticator;
create extension if not exists pgcrypto;
create schema storage;
create table storage.buckets (id text primary key, name text, public boolean);
