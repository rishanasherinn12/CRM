# Pulse CRM

A simple CRM built with React, Vite and Supabase. It has two portals:

- **Admin**: dashboard (leads, customers, sales, conversion, 6-month revenue), full lead management with assignment, customers, sales, and a sales-team performance table where admins can also change roles.
- **Sales Executive**: personal dashboard, my leads (status updates, follow-ups, convert to customer), follow-ups inbox, customers, and recording sales.

Access is enforced in the database with Row Level Security. Sales executives can only read and write their own leads, follow-ups, customers and sales. Admins can access everything.

## Setup

1. **Create a Supabase project** at https://supabase.com.
2. **Create the schema.** Open *SQL Editor* in the Supabase dashboard, paste the contents of [`supabase/schema.sql`](supabase/schema.sql) and run it.
3. **Configure env vars.** Copy `.env.example` to `.env` and fill in your values from *Project Settings → API*:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
   ```
4. **Install and run:**
   ```
   npm install
   npm run dev
   ```

## Creating the first admin

Everyone who signs up gets the **Sales Executive** role. To create an admin:

1. Sign up through the Sales Executive tab, or add a user under *Authentication → Users*.
2. Promote that user in the SQL Editor:
   ```sql
   update public.profiles set role = 'admin' where email = 'you@company.com';
   ```
3. Sign in on the **Admin** tab.

After that, admins can promote or demote other members from the **Sales Team** page.

> Supabase requires email confirmation by default. For local testing you can turn it off under *Authentication → Providers → Email → Confirm email*.

## Data model

| Table        | Purpose                                                   | Who can access                         |
|--------------|-----------------------------------------------------------|----------------------------------------|
| `profiles`   | One row per user: name, email, role (`admin` / `sales`)   | Own row; admins see all                |
| `leads`      | Leads with status, source, value, notes, `assigned_to`    | Assigned executive; admins             |
| `follow_ups` | Dated follow-up notes per lead, with a completed flag     | Whoever can access the parent lead     |
| `customers`  | Customers, optionally linked to the lead they came from   | Owner (`owner_id`); admins             |
| `sales`      | Recorded sales: customer, product, amount, date, notes    | Executive (`sales_exec_id`); admins    |

Lead statuses are New, Contacted, Interested, Converted and Lost. Use **Convert to customer** in a lead's detail view to create the customer record and mark the lead Converted in one step.

## Scripts

- `npm run dev`: start the dev server
- `npm run build`: production build into `dist/`
- `npm run preview`: preview the production build

When you deploy as a static site, configure your host to rewrite every route to `index.html`, because the app uses client-side routing.
