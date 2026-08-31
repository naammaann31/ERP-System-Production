# Progress Report: Melroy F Dmonte

**Designation**: Software Engineer – Backend

## Status Update
Successfully started the migration process from Firebase to Supabase for assigned modules. Here is a sample code snippet outlining the current implementation strategy:

### Code Contribution
```javascript
// Node.js Supabase SDK snippet
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('URL', 'KEY');

async function fetchData() {
  const { data, error } = await supabase.from('users').select('*');
  return data;
}
```
