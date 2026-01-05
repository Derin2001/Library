import { createClient } from '@supabase/supabase-js';

// നിങ്ങളുടെ Supabase URL-ഉം Key-ഉം താഴെ കൊടുക്കണം
const supabaseUrl = 'https://vqfodntrqtbvmvysuxcz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZxZm9kbnRycXRidm12eXN1eGN6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjczNjcxMjgsImV4cCI6MjA4Mjk0MzEyOH0.lUAQgF-j0fcEUyT6pmlUQDHJKsTENycOnfJHrpt8dpM';

export const supabase = createClient(supabaseUrl, supabaseKey);