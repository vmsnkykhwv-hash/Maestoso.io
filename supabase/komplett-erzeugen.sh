#!/usr/bin/env bash
# Erzeugt supabase/komplett.sql aus allen Migrationen – zum einmaligen
# Einfügen in den SQL Editor eines leeren Supabase-Projekts (ohne CLI,
# z. B. vom iPad aus). Nach jeder neuen Migration neu erzeugen; die
# GitHub-Prüfung schlägt fehl, wenn die Datei nicht mehr passt.
set -euo pipefail
cd "$(dirname "$0")"
{
  printf '%s\n' \
    "-- Maestoso: alle Datenbank-Migrationen in einem Durchgang." \
    "-- Nicht von Hand bearbeiten – erzeugt von supabase/komplett-erzeugen.sh." \
    "-- Nur EINMAL auf einem leeren Supabase-Projekt ausführen (SQL Editor → Run)." \
    "-- Läuft als eine Transaktion: bei einem Fehler wird nichts angelegt." \
    "" "begin;" ""
  for f in migrations/*.sql; do
    echo "-- ===== $(basename "$f") ====="
    cat "$f"
    echo
  done
  echo "commit;"
} > komplett.sql
