-- Drop and recreate the view with security_invoker
DROP VIEW IF EXISTS public.borrowing_records_with_details;

CREATE VIEW public.borrowing_records_with_details 
WITH (security_invoker = true)
AS
SELECT 
  br.id,
  br.user_id,
  br.book_id,
  br.status,
  br.request_date,
  br.approval_date,
  br.approved_by,
  br.borrow_date,
  br.due_date,
  br.return_date,
  br.renewal_count,
  br.notes,
  br.created_at,
  br.updated_at,
  row_to_json(b) AS book,
  row_to_json(p) AS profile
FROM public.borrowing_records br
LEFT JOIN public.books b ON b.id = br.book_id
LEFT JOIN public.profiles p ON p.id = br.user_id;