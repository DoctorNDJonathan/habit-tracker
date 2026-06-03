import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://abnfesexmlicwmtsaxgj.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFibmZlc2V4bWxpY3dtdHNheGdqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTgyMjEsImV4cCI6MjA5NTQ5NDIyMX0.Zfq3Vcx3sdwUBVnudjn7ulzO4NjgEedFG4ClUK45r7A';

export const supabase = createClient(supabaseUrl, supabaseKey);