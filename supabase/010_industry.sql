-- Migration 010: Add industry field to businesses

alter table businesses
  add column if not exists industry text;
